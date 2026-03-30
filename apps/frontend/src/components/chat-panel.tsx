import type { ChatRequest, UploadResponse } from '@chat-rag/shared'
import type { FormEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { streamChatMessage } from '../lib/chat/stream'
import { clearChatHistory, loadChatHistory, saveChatHistory } from '../lib/storage/chat-history'
import type { UiChatMessage } from '../lib/types'

interface ChatPanelProps {
  latestUpload: UploadResponse | null
}

function createMessageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function mapHistory(messages: UiChatMessage[]): ChatRequest['history'] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function sourceLabel(source: { source: string; chunkIndex?: number }): string {
  if (typeof source.chunkIndex === 'number') {
    return `${source.source} (chunk ${source.chunkIndex})`
  }

  return source.source
}

export default function ChatPanel({ latestUpload }: ChatPanelProps) {
  const [messages, setMessages] = useState<UiChatMessage[]>(() => loadChatHistory())
  const [input, setInput] = useState('')
  const [isSending, setIsSending] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const messageEndRef = useRef<HTMLDivElement | null>(null)

  const hasMessages = messages.length > 0

  useEffect(() => {
    saveChatHistory(messages)
  }, [messages])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, isSending])

  const subtitle = useMemo(() => {
    if (!latestUpload) {
      return 'Upload a file, then ask a question to begin retrieval.'
    }

    return `Ready with ${latestUpload.filename} in collection ${latestUpload.collectionName}.`
  }, [latestUpload])

  async function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedInput = input.trim()
    if (trimmedInput.length === 0 || isSending) {
      return
    }

    const priorMessages = messages
    const userMessage: UiChatMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedInput,
      createdAt: Date.now(),
    }

    const assistantMessageId = createMessageId()
    const assistantMessage: UiChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      sources: [],
      createdAt: Date.now(),
    }

    setMessages((previous) => [...previous, userMessage, assistantMessage])
    setInput('')
    setErrorMessage(null)
    setIsSending(true)

    try {
      await streamChatMessage({
        request: {
          message: trimmedInput,
          history: mapHistory(priorMessages),
        },
        onEvent: (event) => {
          if (event.type === 'sources') {
            setMessages((previous) =>
              previous.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message
                }

                return {
                  ...message,
                  sources: event.sources,
                }
              }),
            )
            return
          }

          if (event.type === 'token') {
            setMessages((previous) =>
              previous.map((message) => {
                if (message.id !== assistantMessageId) {
                  return message
                }

                return {
                  ...message,
                  content: `${message.content}${event.token}`,
                }
              }),
            )
          }
        },
      })

      setMessages((previous) =>
        previous.map((message) => {
          if (message.id !== assistantMessageId || message.content.trim().length > 0) {
            return message
          }

          return {
            ...message,
            content: 'No response was generated from the stream.',
          }
        }),
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach chat service.'
      setErrorMessage(message)

      setMessages((previous) =>
        previous.filter((message) => {
          if (message.id !== assistantMessageId) {
            return true
          }

          return message.content.trim().length > 0
        }),
      )
    } finally {
      setIsSending(false)
    }
  }

  function handleClearConversation() {
    setMessages([])
    setErrorMessage(null)
    clearChatHistory()
  }

  return (
    <section className="island-shell rise-in flex min-h-[640px] flex-col rounded-3xl p-4 sm:p-5">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <p className="island-kicker mb-2">Chat</p>
          <h2 className="m-0 text-xl font-bold text-[var(--sea-ink)]">Document Q&A Assistant</h2>
          <p className="m-0 mt-1 text-sm text-[var(--sea-ink-soft)]">{subtitle}</p>
        </div>

        <button
          type="button"
          onClick={handleClearConversation}
          className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.78)] px-3 py-2 text-xs font-semibold text-[var(--sea-ink-soft)] transition hover:border-[var(--chip-line)]"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.62)] p-3">
        {!hasMessages ? (
          <div className="rounded-2xl border border-dashed border-[var(--line)] bg-[rgba(255,255,255,0.58)] p-5 text-sm text-[var(--sea-ink-soft)]">
            Ask about specific details from your uploaded files. Responses are grounded to retrieved chunks from Chroma.
          </div>
        ) : null}

        {messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm leading-6 ${
              message.role === 'user'
                ? 'ml-auto border border-[rgba(50,143,151,0.34)] bg-[rgba(79,184,178,0.18)] text-[var(--sea-ink)]'
                : 'border border-[var(--line)] bg-[rgba(255,255,255,0.84)] text-[var(--sea-ink)]'
            }`}
          >
            <p className="m-0 whitespace-pre-wrap">{message.content}</p>

            {message.role === 'assistant' && message.sources && message.sources.length > 0 ? (
              <div className="mt-3 border-t border-[var(--line)] pt-2">
                <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--sea-ink-soft)]">
                  Sources
                </p>
                <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                  {message.sources.map(sourceLabel).join(', ')}
                </p>
              </div>
            ) : null}
          </article>
        ))}

        {isSending ? (
          <div className="w-full max-w-[90%] rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.8)] px-4 py-3">
            <div className="h-2 w-20 animate-pulse rounded bg-[rgba(65,97,102,0.28)]" />
            <div className="mt-2 h-2 w-56 animate-pulse rounded bg-[rgba(65,97,102,0.2)]" />
          </div>
        ) : null}

        <div ref={messageEndRef} />
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-[rgba(153,43,43,0.24)] bg-[rgba(153,43,43,0.1)] px-3 py-2 text-xs text-[#7a2a2a]">
          {errorMessage}
        </p>
      ) : null}

      <form onSubmit={handleSend} className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask a question about your uploaded documents..."
          className="flex-1 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.86)] px-3 py-2 text-sm text-[var(--sea-ink)] outline-none placeholder:text-[var(--sea-ink-soft)] focus:border-[var(--lagoon-deep)]"
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={isSending || input.trim().length === 0}
          className="rounded-xl border border-[var(--chip-line)] bg-[linear-gradient(90deg,#4fb8b2,#74cfb0)] px-4 py-2 text-sm font-semibold text-[#08363b] transition disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSending ? 'Thinking...' : 'Send'}
        </button>
      </form>
    </section>
  )
}
