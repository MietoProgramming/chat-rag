import type { UiChatMessage } from '../types'

const CHAT_HISTORY_STORAGE_KEY = 'chat-rag:chat-history:v1'

function isValidRole(value: unknown): value is 'user' | 'assistant' {
  return value === 'user' || value === 'assistant'
}

function isValidStoredMessage(value: unknown): value is UiChatMessage {
  if (!value || typeof value !== 'object') {
    return false
  }

  const candidate = value as {
    id?: unknown
    role?: unknown
    content?: unknown
    createdAt?: unknown
  }

  return (
    typeof candidate.id === 'string' &&
    isValidRole(candidate.role) &&
    typeof candidate.content === 'string' &&
    typeof candidate.createdAt === 'number'
  )
}

export function loadChatHistory(): UiChatMessage[] {
  if (typeof window === 'undefined') {
    return []
  }

  const rawValue = window.localStorage.getItem(CHAT_HISTORY_STORAGE_KEY)
  if (!rawValue) {
    return []
  }

  try {
    const parsed = JSON.parse(rawValue) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter(isValidStoredMessage)
  } catch {
    return []
  }
}

export function saveChatHistory(messages: UiChatMessage[]): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(CHAT_HISTORY_STORAGE_KEY, JSON.stringify(messages))
}

export function clearChatHistory(): void {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(CHAT_HISTORY_STORAGE_KEY)
}
