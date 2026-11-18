export const PARTICIPANT_ROLE = 'app_participant'

export type SqlRow = Record<string, unknown>

export type SqlClient = {
  query: (sql: string, params?: readonly unknown[]) => Promise<{ rows: SqlRow[] }>
}

const DUPLICATE_OBJECT = '42710'

export function participantDbPassword(): string | null {
  const value = process.env.PARTICIPANT_DB_PASSWORD?.trim()
  return value ? value : null
}

export function redactSecret(message: string, secret: string): string {
  if (!secret) return message
  return message.split(secret).join('[redacted]')
}

export function quoteIdent(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export function grantStatements(
  database: string
): [string, string, string, string, string, string] {
  const name = quoteIdent(database)
  return [
    `GRANT ${PARTICIPANT_ROLE} TO CURRENT_USER`,
    `GRANT CONNECT ON DATABASE ${name} TO ${PARTICIPANT_ROLE}`,
    `GRANT USAGE ON SCHEMA public TO ${PARTICIPANT_ROLE}`,
    `GRANT SELECT (id, email, name, role, "disabledAt") ON TABLE "User" TO ${PARTICIPANT_ROLE}`,
    `GRANT SELECT (id, "userId") ON TABLE "WebAuthnCredential" TO ${PARTICIPANT_ROLE}`,
    `GRANT SELECT ON TABLE "App", "AppGrant" TO ${PARTICIPANT_ROLE}`
  ]
}

export const createParticipantSchemaFunctionSql = `
CREATE OR REPLACE FUNCTION public.create_participant_schema(schema_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $body$
DECLARE
  owner_name name;
BEGIN
  IF schema_name IS NULL
     OR schema_name !~ '^[a-z_][a-z0-9_]{0,62}$'
     OR schema_name IN ('public', 'information_schema')
     OR schema_name ~ '^pg_' THEN
    RAISE EXCEPTION 'スキーマ名が不正です';
  END IF;

  SELECT pg_roles.rolname
    INTO owner_name
    FROM pg_namespace
    JOIN pg_roles ON pg_roles.oid = pg_namespace.nspowner
   WHERE pg_namespace.nspname = schema_name;

  IF owner_name IS NULL THEN
    EXECUTE format('CREATE SCHEMA %I AUTHORIZATION ${PARTICIPANT_ROLE}', schema_name);
    RETURN;
  END IF;

  IF owner_name <> '${PARTICIPANT_ROLE}' THEN
    RAISE EXCEPTION 'スキーマの所有者が ${PARTICIPANT_ROLE} ではありません';
  END IF;
END;
$body$
`

export const revokeParticipantSchemaFunctionSql =
  'REVOKE ALL ON FUNCTION public.create_participant_schema(text) FROM PUBLIC'

export const grantParticipantSchemaFunctionSql = `GRANT EXECUTE ON FUNCTION public.create_participant_schema(text) TO ${PARTICIPANT_ROLE}`

function isDuplicateObject(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === DUPLICATE_OBJECT
  )
}

function canCreateRole(row: SqlRow | undefined): boolean {
  if (!row) return false
  return row.rolsuper === true || row.rolcreaterole === true
}

async function createRole(client: SqlClient, password: string): Promise<void> {
  const privilege = await client.query(
    'SELECT rolsuper, rolcreaterole FROM pg_roles WHERE rolname = current_user'
  )
  if (!canCreateRole(privilege.rows[0])) {
    throw new Error('データベースユーザーに CREATEROLE がありません')
  }

  const formatted = await client.query(
    `SELECT format('CREATE ROLE ${PARTICIPANT_ROLE} LOGIN PASSWORD %L', $1::text) AS sql`,
    [password]
  )
  const sql = formatted.rows[0]?.sql
  if (
    typeof sql !== 'string' ||
    !sql.startsWith(`CREATE ROLE ${PARTICIPANT_ROLE} LOGIN PASSWORD `)
  ) {
    throw new Error('ロール作成文を組み立てられません')
  }

  try {
    await client.query(sql)
  } catch (error) {
    if (!isDuplicateObject(error)) throw error
  }
}

export async function ensureParticipantRole(client: SqlClient): Promise<void> {
  const password = participantDbPassword()
  if (!password) return

  const existing = await client.query(
    `SELECT 1 AS ok FROM pg_roles WHERE rolname = '${PARTICIPANT_ROLE}'`
  )
  if (existing.rows.length === 0) await createRole(client, password)

  const database = await client.query('SELECT current_database() AS name')
  const name = database.rows[0]?.name
  if (typeof name !== 'string' || name.length === 0) {
    throw new Error('データベース名を取得できません')
  }

  const [membership, connect, usage, userColumns, credentialColumns, appTables] =
    grantStatements(name)
  await client.query(membership)
  await client.query(connect)
  await client.query(usage)
  await client.query(userColumns)
  await client.query(credentialColumns)
  await client.query(appTables)
  await client.query(createParticipantSchemaFunctionSql)
  await client.query(revokeParticipantSchemaFunctionSql)
  await client.query(grantParticipantSchemaFunctionSql)
}
