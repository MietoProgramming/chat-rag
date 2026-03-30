import type { ChatRequest, ChatResponse, UploadResponse } from '@chat-rag/shared'
import { createServerFn } from '@tanstack/react-start'
import { buildBackendUrl } from './backend-url'

async function readBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[]
      error?: string
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ')
    }

    if (typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message
    }

    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error
    }
  } catch {
    const text = await response.text()
    if (text.length > 0) {
      return text
    }
  }

  return `Request failed with status ${response.status}`
}

export const uploadDocumentFn = createServerFn({ method: 'POST' })
  .inputValidator((input: FormData) => input)
  .handler(async ({ data }) => {
    const response = await fetch(buildBackendUrl('/api/documents/upload'), {
      method: 'POST',
      body: data,
    })

    if (!response.ok) {
      throw new Error(await readBackendError(response))
    }

    return (await response.json()) as UploadResponse
  })

export const sendChatMessageFn = createServerFn({ method: 'POST' })
  .inputValidator((input: ChatRequest) => input)
  .handler(async ({ data }) => {
    const response = await fetch(buildBackendUrl('/api/chat/message'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error(await readBackendError(response))
    }

    return (await response.json()) as ChatResponse
  })
