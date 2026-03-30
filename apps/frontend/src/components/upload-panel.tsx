import type { UploadResponse } from '@chat-rag/shared'
import { useMemo, useState } from 'react'
import { uploadDocumentFn } from '../lib/server/api'

interface UploadPanelProps {
  onUploadComplete: (result: UploadResponse) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export default function UploadPanel({ onUploadComplete }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const acceptedDescription = useMemo(() => 'PDF or TXT up to 10 MB', [])

  function handleSelectedFile(selectedFile: File | null) {
    if (!selectedFile) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setFile(selectedFile)
  }

  async function handleUpload() {
    if (!file) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.set('file', file)

      const result = await uploadDocumentFn({ data: formData })
      onUploadComplete(result)

      setSuccessMessage(`Indexed ${result.filename} (${result.chunksStored} chunks).`)
      setFile(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      setErrorMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <aside className="island-shell rise-in rounded-3xl p-5 sm:p-6">
      <p className="island-kicker mb-2">Documents</p>
      <h2 className="mb-2 text-xl font-bold text-[var(--sea-ink)]">Upload Knowledge Files</h2>
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">Drop files here or pick one manually. The assistant answers only from indexed content.</p>

      <label
        onDragOver={(event) => {
          event.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          setIsDragging(false)
        }}
        onDrop={(event) => {
          event.preventDefault()
          setIsDragging(false)
          handleSelectedFile(event.dataTransfer.files.item(0))
        }}
        className={`block cursor-pointer rounded-2xl border border-dashed px-4 py-8 text-center transition ${
          isDragging
            ? 'border-[var(--lagoon-deep)] bg-[rgba(79,184,178,0.2)]'
            : 'border-[var(--line)] bg-[rgba(255,255,255,0.65)]'
        }`}
      >
        <input
          type="file"
          className="hidden"
          accept=".pdf,.txt,text/plain,application/pdf"
          onChange={(event) => handleSelectedFile(event.target.files?.item(0) ?? null)}
        />
        <p className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">Choose file</p>
        <p className="text-xs text-[var(--sea-ink-soft)]">{acceptedDescription}</p>
      </label>

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-3">
        {file ? (
          <>
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">{file.name}</p>
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">{formatFileSize(file.size)}</p>
          </>
        ) : (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">No file selected.</p>
        )}
      </div>

      <button
        type="button"
        disabled={!file || isUploading}
        onClick={handleUpload}
        className="mt-4 w-full rounded-xl border border-[var(--chip-line)] bg-[linear-gradient(90deg,#4fb8b2,#74cfb0)] px-4 py-2.5 text-sm font-semibold text-[#08363b] transition disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isUploading ? 'Indexing document...' : 'Upload & Index'}
      </button>

      {successMessage ? (
        <p className="mt-3 rounded-xl border border-[rgba(47,106,74,0.24)] bg-[rgba(47,106,74,0.12)] px-3 py-2 text-xs text-[var(--palm)]">
          {successMessage}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="mt-3 rounded-xl border border-[rgba(153,43,43,0.24)] bg-[rgba(153,43,43,0.1)] px-3 py-2 text-xs text-[#7a2a2a]">
          {errorMessage}
        </p>
      ) : null}
    </aside>
  )
}
