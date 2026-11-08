import { randomUUID } from 'node:crypto'
import { redis } from '@/lib/redis'
import { SESSION_MAX_AGE_SECONDS } from '@/server/auth/env'
import { redisKey } from '@/server/auth/redis-env'
import { RedisKeys } from '@/server/redis/keys'

export type SessionRecord = {
  id: string
  userId: string
  appId: string
  createdAt: string
  tokenHash: string
}

export function sessionIndexMember(appId: string, tokenHash: string): string {
  return `${appId}/${tokenHash}`
}

function parseIndexMember(member: string): { appId: string; tokenHash: string } | null {
  const slash = member.indexOf('/')
  if (slash <= 0 || slash === member.length - 1) return null
  return { appId: member.slice(0, slash), tokenHash: member.slice(slash + 1) }
}

let persistingIndexes: Promise<void> | null = null

export async function ensureSessionUserIndexesPersist(): Promise<void> {
  if (!persistingIndexes) {
    persistingIndexes = persistSessionUserIndexes().catch((error: unknown) => {
      persistingIndexes = null
      throw error
    })
  }
  await persistingIndexes
}

async function scanKeys(cursor: string, match: string): Promise<string[]> {
  const [next, keys] = await redis.scan(cursor, 'MATCH', match, 'COUNT', 200)
  if (next === '0') return keys
  const rest = await scanKeys(next, match)
  return keys.concat(rest)
}

export async function persistSessionUserIndexes(): Promise<void> {
  const keys = await scanKeys('0', redisKey('sess:user:*'))
  if (keys.length === 0) return
  const pipeline = redis.pipeline()
  for (const key of keys) {
    pipeline.persist(key)
  }
  await pipeline.exec()
}

async function removeStaleIndexMembers(userId: string): Promise<void> {
  const userKey = RedisKeys.sessionUser(userId)
  const members = await redis.smembers(userKey)
  if (members.length === 0) return

  const parsedMembers = members.map((member) => {
    const parsed = parseIndexMember(member)
    return {
      member,
      key: parsed ? RedisKeys.session(parsed.appId, parsed.tokenHash) : null
    }
  })

  const existing = redis.pipeline()
  for (const entry of parsedMembers) {
    if (entry.key) existing.exists(entry.key)
  }
  const results = parsedMembers.some((entry) => entry.key) ? await existing.exec() : []

  const stale: string[] = []
  let resultIndex = 0
  for (const entry of parsedMembers) {
    if (!entry.key) {
      stale.push(entry.member)
      continue
    }
    const result = results?.[resultIndex]
    resultIndex += 1
    if (!result || result[0]) {
      throw result?.[0] ?? new Error('セッション索引の確認に失敗しました')
    }
    if (result[1] !== 1) stale.push(entry.member)
  }

  if (stale.length > 0) {
    await redis.srem(userKey, ...stale)
  }
}

class SessionDB {
  async create(appId: string, userId: string, tokenHash: string): Promise<SessionRecord> {
    const record: SessionRecord = {
      id: randomUUID(),
      userId,
      appId,
      createdAt: new Date().toISOString(),
      tokenHash
    }
    const ttl = SESSION_MAX_AGE_SECONDS
    const sessionKey = RedisKeys.session(appId, tokenHash)
    const userKey = RedisKeys.sessionUser(userId)

    await removeStaleIndexMembers(userId)

    const pipeline = redis.pipeline()
    pipeline.set(
      sessionKey,
      JSON.stringify({
        id: record.id,
        userId: record.userId,
        appId: record.appId,
        createdAt: record.createdAt
      }),
      'EX',
      ttl
    )
    pipeline.sadd(userKey, sessionIndexMember(appId, tokenHash))
    pipeline.persist(userKey)
    await pipeline.exec()

    return record
  }

  async findValid(appId: string, tokenHash: string): Promise<SessionRecord | null> {
    const raw = await redis.get(RedisKeys.session(appId, tokenHash))
    if (!raw) return null

    try {
      const parsed = JSON.parse(raw) as Omit<SessionRecord, 'tokenHash'>
      if (!parsed.id || !parsed.userId || parsed.appId !== appId) return null
      return { ...parsed, tokenHash }
    } catch {
      return null
    }
  }

  async touch(appId: string, tokenHash: string) {
    await redis.expire(RedisKeys.session(appId, tokenHash), SESSION_MAX_AGE_SECONDS)
  }

  async revoke(appId: string, tokenHash: string) {
    const session = await this.findValid(appId, tokenHash)
    const pipeline = redis.pipeline()
    pipeline.del(RedisKeys.session(appId, tokenHash))
    if (session) {
      pipeline.srem(RedisKeys.sessionUser(session.userId), sessionIndexMember(appId, tokenHash))
    }
    await pipeline.exec()
  }

  async revokeAllForUser(userId: string) {
    const userKey = RedisKeys.sessionUser(userId)
    const members = await redis.smembers(userKey)
    if (members.length === 0) {
      await redis.del(userKey)
      return
    }

    const pipeline = redis.pipeline()
    for (const member of members) {
      const parsed = parseIndexMember(member)
      if (parsed) {
        pipeline.del(RedisKeys.session(parsed.appId, parsed.tokenHash))
      }
    }
    pipeline.del(userKey)
    await pipeline.exec()
  }

  async countForUser(userId: string): Promise<number> {
    return redis.scard(RedisKeys.sessionUser(userId))
  }
}

export default new SessionDB()
