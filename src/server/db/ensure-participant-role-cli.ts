import 'dotenv/config'
import pg from 'pg'
import {
  ensureParticipantRole,
  participantDbPassword,
  redactSecret
} from '@/server/db/participant-role'

async function main(): Promise<void> {
  const password = participantDbPassword()
  if (!password) {
    console.log('PARTICIPANT_DB_PASSWORD が未設定のため、app_participant は作成しません')
    return
  }
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    console.error('DATABASE_URL がありません')
    process.exitCode = 1
    return
  }

  const client = new pg.Client({ connectionString: databaseUrl })
  await client.connect()
  try {
    await ensureParticipantRole(client)
    console.log('app_participant を用意しました')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'app_participant の用意に失敗しました'
    console.error(redactSecret(message, password))
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main().catch((error: unknown) => {
  const password = participantDbPassword() ?? ''
  const message = error instanceof Error ? error.message : 'app_participant の用意に失敗しました'
  console.error(redactSecret(message, password))
  process.exit(1)
})
