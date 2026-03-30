import type { ChatMessage, ChatSource } from '@chat-rag/shared'

export interface UiChatMessage extends ChatMessage {
  id: string
  sources?: ChatSource[]
  createdAt: number
}
