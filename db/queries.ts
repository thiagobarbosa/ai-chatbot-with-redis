'server-only'

import { genSaltSync, hashSync } from 'bcrypt-ts'

import { Chat, Document, User } from '@/db/schema'
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

export async function saveDocument({
  id,
  title,
  content,
  userId,
}: {
  id: string;
  title: string;
  content: string;
  userId: string;
}) {
  try {
    const redis = await getRedis()
    const pipeline = redis.pipeline()
    const document = {
      id,
      title,
      content,
      userId,
      createdAt: new Date(),
    }

    pipeline.hmset(`document:${document.id}`, document)
    pipeline.zadd(`user:document:${userId}`, Date.now(), `document:${document.id}`)

    return await pipeline.exec()
  } catch (error) {
    throw error
  }
}

export async function getDocumentsById({ id }: { id: string }) {
  try {
    const redis = await getRedis()
    const documents = await redis.zrange(`user:document:${id}`, 0, -1)

    if (documents.length === 0) {
      return []
    }

    const results = await Promise.all(
      documents.map(async document => {
        return await redis.hgetall(document)
      })
    )

    return results
      .filter((result): result is Record<string, any> => {
        return !(result === null || Object.keys(result).length === 0)
      })
  } catch (error) {
    return []
  }
}

export async function getDocumentById({ id }: { id: string }): Promise<Document | null> {
  const redis = await getRedis()
  return await redis.hgetall(`document:${id}`)
}

export async function deleteDocumentsByIdAfterTimestamp({
  id,
  timestamp,
}: {
  id: string;
  timestamp: Date;
}) {
  try {
    const redis = await getRedis()
    const documents = await redis.zrange(`user:document:${id}`, 0, -1)

    if (documents.length === 0) {
      return
    }

    const pipeline = redis.pipeline()

    for (const document of documents) {
      const doc = await redis.hgetall(document) as Document
      if (!doc) {
        continue
      }
      if (doc.createdAt && new Date(doc.createdAt) > timestamp) {
        pipeline.del(document)
        pipeline.zrem(`user:document:${id}`, document)
      }
    }

    return await pipeline.exec()
  } catch (error) {
    throw error
  }
}

export async function saveSuggestions({
  suggestions,
}: {
  suggestions: any[];
}) {
  try {
    const redis = await getRedis()
    const pipeline = redis.pipeline()

    for (const suggestion of suggestions) {
      pipeline.hmset(`suggestion:${suggestion.id}`, suggestion)
      pipeline.zadd(`user:suggestion:${suggestion.userId}`, Date.now(), `suggestion:${suggestion.id}`)
    }

    return await pipeline.exec()
  } catch (error) {
    throw error
  }
}

export async function getSuggestionsByDocumentId({
  documentId,
}: {
  documentId: string;
}) {
  try {
    const redis = await getRedis()
    const suggestions = await redis.zrange(`document:suggestions:${documentId}`, 0, -1, {
      rev: true
    })

    if (suggestions.length === 0) {
      return []
    }

    const results = await Promise.all(
      suggestions.map(async suggestionKey => {
        return await redis.hgetall(suggestionKey)
      })
    )

    return results
      .filter((result): result is Record<string, any> => {
        return !(result === null || Object.keys(result).length === 0)

      })
  } catch (error) {
    return []
  }
}

