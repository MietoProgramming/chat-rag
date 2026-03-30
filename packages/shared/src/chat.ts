export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  role: ChatRole
  content: string
}

export interface ChatRequest {
  message: string
  history?: ChatMessage[]
}

export interface ChatSource {
  source: string
  chunkIndex?: number
}

export interface ChatResponse {
  answer: string
  sources: ChatSource[]
}

export interface ChatStreamSourcesEvent {
  type: 'sources'
  sources: ChatSource[]
}

export interface ChatStreamTokenEvent {
  type: 'token'
  token: string
}

export interface ChatStreamDoneEvent {
  type: 'done'
}

export interface ChatStreamErrorEvent {
  type: 'error'
  message: string
}

export type ChatStreamEvent =
  | ChatStreamSourcesEvent
  | ChatStreamTokenEvent
  | ChatStreamDoneEvent
  | ChatStreamErrorEvent
