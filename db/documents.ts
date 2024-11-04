import { Document } from '@/db/schema'
import { getRedis } from '@/lib/redis/config'

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
