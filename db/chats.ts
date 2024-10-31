'server-only'

import { Chat } from '@/db/schema'
import { getRedis } from '@/lib/redis/config'


export async function saveChat({
  id,
  messages,
  userId,
}: {
  id: string;
  messages: any;
  userId: string;
}) {
  try {
    const redis = await getRedis()
    const pipeline = redis.pipeline()
    const chat = {
      id,
      messages,
      userId,
      createdAt: new Date(),
    }

    const chatToSave = {
      ...chat,
      messages: JSON.stringify(chat.messages)
    }

    pipeline.hmset(`chat:${chat.id}`, chatToSave)
    pipeline.zadd(`user:chat:${userId}`, Date.now(), `chat:${chat.id}`)

    return await pipeline.exec()
  } catch (error) {
    throw error
  }
}

export async function deleteChatById({ id, userId }: { id: string, userId: string }) {
  try {
    const redis = await getRedis()
    await redis.del(`chat:${id}`)

    await redis.zrem(`user:chat:${userId}`, `chat:${id}`)

    return await redis.del(`user:chat:${id}`)
  } catch (error) {
    console.error('Failed to delete chat by id from database')
    throw error
  }
}

export async function getChatsByUserId({ id }: { id: string }) {
  try {
    const redis = await getRedis()
    const chats = await redis.zrange(`user:chat:${id}`, 0, -1, {
      rev: true
    })

    if (chats.length === 0) {
      return []
    }

    const results = await Promise.all(
      chats.map(async chatKey => {
        return await redis.hgetall(chatKey)
      })
    )

    return results
      .filter((result): result is Chat => {
        return !(result === null || Object.keys(result).length === 0)

      })
      .map(chat => {
        const plainChat = { ...chat }
        if (typeof plainChat.messages === 'string') {
          try {
            plainChat.messages = JSON.parse(plainChat.messages)
          } catch (error) {
            plainChat.messages = []
          }
        }
        if (plainChat.createdAt && !(plainChat.createdAt instanceof Date)) {
          plainChat.createdAt = new Date(plainChat.createdAt)
        }
        return plainChat as Chat
      })
  } catch (error) {
    return []
  }
}

export async function getChatById({ id }: { id: string }) {
  const redis = await getRedis()
  const chat = await redis.hgetall<Chat>(`chat:${id}`)

  if (!chat) {
    return null
  }

  // Ensure messages is always an array
  if (!Array.isArray(chat.messages)) {
    chat.messages = []
  }

  return chat
}


