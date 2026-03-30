import type { ChatRequest, ChatStreamEvent } from '@chat-rag/shared'

interface StreamChatMessageOptions {
  request: ChatRequest
  onEvent: (event: ChatStreamEvent) => void
}

async function readStreamError(response: Response): Promise<string> {
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

function parseStreamEvent(line: string): ChatStreamEvent {
  const parsed = JSON.parse(line) as {
    type?: unknown
    token?: unknown
    message?: unknown
    sources?: unknown
  }

  if (parsed.type === 'token' && typeof parsed.token === 'string') {
    return {
      type: 'token',
      token: parsed.token,
    }
  }

  if (parsed.type === 'sources' && Array.isArray(parsed.sources)) {
    const sources = parsed.sources
      .filter((source): source is { source: string; chunkIndex?: unknown } => {
        return (
          !!source &&
          typeof source === 'object' &&
          'source' in source &&
          typeof source.source === 'string'
        )
      })
      .map((source) => {
        return {
          source: source.source,
          chunkIndex:
            typeof source.chunkIndex === 'number' ? source.chunkIndex : undefined,
        }
      })

    return {
      type: 'sources',
      sources,
    }
  }

  if (parsed.type === 'done') {
    return {
      type: 'done',
    }
  }

  if (parsed.type === 'error' && typeof parsed.message === 'string') {
    return {
      type: 'error',
      message: parsed.message,
    }
  }

  throw new Error('Received an unsupported stream event.')
}

function drainBuffer(
  buffer: string,
  onEvent: (event: ChatStreamEvent) => void,
): string {
  let pendingBuffer = buffer

  while (true) {
    const lineBreakIndex = pendingBuffer.indexOf('\n')
    if (lineBreakIndex < 0) {
      return pendingBuffer
    }

    const rawLine = pendingBuffer.slice(0, lineBreakIndex)
    pendingBuffer = pendingBuffer.slice(lineBreakIndex + 1)

    const line = rawLine.trim()
    if (line.length === 0) {
      continue
    }

    const event = parseStreamEvent(line)
    onEvent(event)

    if (event.type === 'error') {
      throw new Error(event.message)
    }
  }
}

export async function streamChatMessage({
  request,
  onEvent,
}: StreamChatMessageOptions): Promise<void> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(await readStreamError(response))
  }

  if (!response.body) {
    throw new Error('Streaming response body is missing.')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()

    if (done) {
      buffer += decoder.decode()
      break
    }

    buffer += decoder.decode(value, { stream: true })
    buffer = drainBuffer(buffer, onEvent)
  }

  const trailing = buffer.trim()
  if (trailing.length > 0) {
    const event = parseStreamEvent(trailing)
    onEvent(event)

    if (event.type === 'error') {
      throw new Error(event.message)
    }
  }
}
