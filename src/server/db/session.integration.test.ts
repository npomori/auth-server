import { beforeEach, describe, expect, it } from 'vitest'
import { redis } from '@/lib/redis'
import { authEnv } from '@/server/auth/env'
import { generateToken, hashToken } from '@/server/auth/tokens'
import SessionDB, { persistSessionUserIndexes, sessionIndexMember } from '@/server/db/session'
import { RedisKeys } from '@/server/redis/keys'
import { createTestUser, resetDatabase } from '@/test/db'

describe('SessionDB', () => {
  beforeEach(async () => {
    await resetDatabase()
  })

  it('creates and finds a valid session', async () => {
    const { user } = await createTestUser()
    const token = generateToken()
    const created = await SessionDB.create(authEnv.appId(), user.id, hashToken(token))

    const found = await SessionDB.findValid(authEnv.appId(), hashToken(token))
    expect(found).toMatchObject({
      id: created.id,
      userId: user.id
    })
  })

  it('touches session TTL', async () => {
    const { user } = await createTestUser()
    const token = generateToken()
    const tokenHash = hashToken(token)
    await SessionDB.create(authEnv.appId(), user.id, tokenHash)

    const key = RedisKeys.session(authEnv.appId(), tokenHash)
    await redis.expire(key, 90)
    const before = await redis.ttl(key)

    const userKey = RedisKeys.sessionUser(user.id)
    expect(await redis.ttl(userKey)).toBe(-1)
    await redis.expire(userKey, 90)

    await SessionDB.touch(authEnv.appId(), tokenHash)
    const after = await redis.ttl(key)
    expect(after).toBeGreaterThan(before)
    const indexTtl = await redis.ttl(userKey)
    expect(indexTtl).toBeGreaterThan(0)
    expect(indexTtl).toBeLessThanOrEqual(90)
  })

  it('leaves the user index without a TTL and drops members whose sessions are gone', async () => {
    const { user } = await createTestUser()
    const staleHash = hashToken(generateToken())
    const nextHash = hashToken(generateToken())
    await SessionDB.create(authEnv.appId(), user.id, staleHash)

    const userKey = RedisKeys.sessionUser(user.id)
    await redis.expire(userKey, 90)
    await redis.del(RedisKeys.session(authEnv.appId(), staleHash))
    await redis.sadd(userKey, 'not-a-member')

    await SessionDB.create('app', user.id, nextHash)

    expect(await redis.ttl(userKey)).toBe(-1)
    expect(await redis.smembers(userKey)).toEqual([sessionIndexMember('app', nextHash)])
    expect(await SessionDB.countForUser(user.id)).toBe(1)
  })

  it('persists existing user indexes', async () => {
    const { user } = await createTestUser()
    const tokenHash = hashToken(generateToken())
    await SessionDB.create(authEnv.appId(), user.id, tokenHash)

    const userKey = RedisKeys.sessionUser(user.id)
    await redis.expire(userKey, 90)

    await persistSessionUserIndexes()

    expect(await redis.ttl(userKey)).toBe(-1)
    expect(await SessionDB.findValid(authEnv.appId(), tokenHash)).toBeTruthy()
  })

  it('revokes a single session', async () => {
    const { user } = await createTestUser()
    const a = generateToken()
    const b = generateToken()
    await SessionDB.create(authEnv.appId(), user.id, hashToken(a))
    await SessionDB.create(authEnv.appId(), user.id, hashToken(b))

    await SessionDB.revoke(authEnv.appId(), hashToken(a))
    expect(await SessionDB.findValid(authEnv.appId(), hashToken(a))).toBeNull()
    expect(await SessionDB.findValid(authEnv.appId(), hashToken(b))).toBeTruthy()
    expect(await SessionDB.countForUser(user.id)).toBe(1)
  })

  it('revokes all sessions for a user', async () => {
    const { user } = await createTestUser()
    const authHash = hashToken(generateToken())
    const appHash = hashToken(generateToken())
    await SessionDB.create(authEnv.appId(), user.id, authHash)
    await SessionDB.create('app', user.id, appHash)

    await SessionDB.revokeAllForUser(user.id)
    expect(await SessionDB.countForUser(user.id)).toBe(0)
    expect(await SessionDB.findValid(authEnv.appId(), authHash)).toBeNull()
    expect(await SessionDB.findValid('app', appHash)).toBeNull()
  })
})
