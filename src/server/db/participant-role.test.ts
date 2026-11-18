import { afterEach, describe, expect, it } from 'vitest'
import {
  createParticipantSchemaFunctionSql,
  ensureParticipantRole,
  grantStatements,
  participantDbPassword,
  redactSecret,
  type SqlClient,
  type SqlRow
} from '@/server/db/participant-role'

type Query = { sql: string; params?: readonly unknown[] }

function clientFor(options: {
  roleExists?: boolean
  privileged?: boolean
  duplicate?: boolean
  database?: string
}): { client: SqlClient; queries: Query[] } {
  const queries: Query[] = []
  let roleExists = options.roleExists ?? false
  const client: SqlClient = {
    query: async (sql, params) => {
      queries.push({ sql, params })
      if (sql.includes('WHERE rolname = current_user')) {
        const row: SqlRow = options.privileged
          ? { rolsuper: false, rolcreaterole: true }
          : { rolsuper: false, rolcreaterole: false }
        return { rows: [row] }
      }
      if (sql.includes("rolname = 'app_participant'") && sql.includes('SELECT 1')) {
        return { rows: roleExists ? [{ ok: 1 }] : [] }
      }
      if (sql.startsWith('SELECT format(')) {
        const password = String(params?.[0] ?? '')
        return {
          rows: [
            {
              sql: `CREATE ROLE app_participant LOGIN PASSWORD '${password.replaceAll("'", "''")}'`
            }
          ]
        }
      }
      if (sql.startsWith('CREATE ROLE')) {
        if (options.duplicate) {
          const error = new Error('duplicate') as Error & { code: string }
          error.code = '42710'
          throw error
        }
        roleExists = true
        return { rows: [] }
      }
      if (sql.includes('current_database()')) {
        return { rows: [{ name: options.database ?? 'astro_webauthn' }] }
      }
      return { rows: [] }
    }
  }
  return { client, queries }
}

describe('participant database role', () => {
  afterEach(() => {
    delete process.env.PARTICIPANT_DB_PASSWORD
  })

  it('treats a blank password as unset', () => {
    process.env.PARTICIPANT_DB_PASSWORD = '   '
    expect(participantDbPassword()).toBeNull()
  })

  it('does nothing when the password is unset', async () => {
    const { client, queries } = clientFor({})
    await ensureParticipantRole(client)
    expect(queries).toEqual([])
  })

  it('creates the role and re-applies grants', async () => {
    process.env.PARTICIPANT_DB_PASSWORD = "se'cret"
    const { client, queries } = clientFor({ privileged: true, database: 'my"db' })
    await ensureParticipantRole(client)

    expect(queries.map((query) => query.sql)).toEqual([
      "SELECT 1 AS ok FROM pg_roles WHERE rolname = 'app_participant'",
      'SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user',
      "SELECT format('CREATE ROLE app_participant LOGIN PASSWORD %L', $1::text) AS sql",
      "CREATE ROLE app_participant LOGIN PASSWORD 'se''cret'",
      'SELECT current_database() AS name',
      ...grantStatements('my"db'),
      createParticipantSchemaFunctionSql,
      'REVOKE ALL ON FUNCTION public.create_participant_schema(text) FROM PUBLIC',
      'GRANT EXECUTE ON FUNCTION public.create_participant_schema(text) TO app_participant'
    ])
    expect(queries[2]?.params).toEqual(["se'cret"])
  })

  it('keeps an existing password and still grants', async () => {
    process.env.PARTICIPANT_DB_PASSWORD = 'secret'
    const { client, queries } = clientFor({ roleExists: true })
    await ensureParticipantRole(client)
    expect(queries.some((query) => query.sql.startsWith('CREATE ROLE'))).toBe(false)
    expect(queries.some((query) => query.sql.startsWith('GRANT CONNECT'))).toBe(true)
  })

  it('continues when role creation races', async () => {
    process.env.PARTICIPANT_DB_PASSWORD = 'secret'
    const { client } = clientFor({ privileged: true, duplicate: true })
    await expect(ensureParticipantRole(client)).resolves.toBeUndefined()
  })

  it('stops when the user cannot create a role', async () => {
    process.env.PARTICIPANT_DB_PASSWORD = 'secret'
    const { client, queries } = clientFor({ privileged: false })
    await expect(ensureParticipantRole(client)).rejects.toThrow('CREATEROLE')
    expect(queries.some((query) => query.sql.startsWith('CREATE ROLE'))).toBe(false)
  })

  it('limits the schema function to a quoted identifier', () => {
    expect(createParticipantSchemaFunctionSql).toContain('SECURITY DEFINER')
    expect(createParticipantSchemaFunctionSql).toContain('SET search_path = pg_catalog')
    expect(createParticipantSchemaFunctionSql).toContain(
      "EXECUTE format('CREATE SCHEMA %I AUTHORIZATION app_participant', schema_name)"
    )
    expect(createParticipantSchemaFunctionSql).toContain("'public', 'information_schema'")
    expect(createParticipantSchemaFunctionSql).toContain("schema_name ~ '^pg_'")
    expect(grantStatements('db').join('\n')).not.toContain('RoleChange')
    expect(grantStatements('db').join('\n')).not.toContain('CREATE ON DATABASE')
  })

  it('redacts the password from errors', () => {
    expect(redactSecret("password 'secret' failed", 'secret')).toBe("password '[redacted]' failed")
  })
})
