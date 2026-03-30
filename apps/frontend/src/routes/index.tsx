import type { UploadResponse } from '@chat-rag/shared'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import ChatPanel from '../components/chat-panel'
import UploadPanel from '../components/upload-panel'

export const Route = createFileRoute('/')({ component: App })

function App() {
  const [latestUpload, setLatestUpload] = useState<UploadResponse | null>(null)

  return (
    <main className="page-wrap px-4 pb-8 pt-10">
      <section className="island-shell rise-in relative mb-6 overflow-hidden rounded-[2rem] px-6 py-7 sm:px-8">
        <div className="pointer-events-none absolute -left-16 -top-14 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(79,184,178,0.28),transparent_68%)]" />
        <div className="pointer-events-none absolute -bottom-16 -right-16 h-44 w-44 rounded-full bg-[radial-gradient(circle,rgba(47,106,74,0.18),transparent_70%)]" />
        <p className="island-kicker mb-2">RAG Workspace</p>
        <h1 className="display-title m-0 text-3xl font-bold text-[var(--sea-ink)] sm:text-5xl">
          Document Q&A Chatbot
        </h1>
        <p className="mt-3 max-w-3xl text-sm text-[var(--sea-ink-soft)] sm:text-base">
          Upload PDFs or text files, then ask questions. Responses are generated only from chunks retrieved from your indexed context.
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
        <UploadPanel onUploadComplete={setLatestUpload} />
        <ChatPanel latestUpload={latestUpload} />
      </div>
    </main>
  )
}
