import { genSaltSync, hashSync } from 'bcrypt-ts'

import { User } from '@/db/schema'
import { getRedis } from '@/lib/redis/config'
import { generateUUID } from '@/lib/utils'

export async function getUser(email: string): Promise<User | null> {
  try {
    const redis = await getRedis()
    return await redis.hgetall(`user:${email}`) as User | null
  } catch (error) {
    console.error('Failed to get user from database')
    throw error
  }
}

export async function createUser(email: string, password: string) {
  let salt = genSaltSync(10)
  let hash = hashSync(password, salt)

  try {
    const redis = await getRedis()
    const pipeline = redis.pipeline()
    const user = {
      id: generateUUID(),
      email,
      password: hash,
    }

    pipeline.hmset(`user:${email}`, user)
    pipeline.zadd('users', Date.now(), email)

    return await pipeline.exec()
  } catch (error) {
    console.error('Failed to create user in database')
    throw error
  }
}