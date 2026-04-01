import type { DocumentRecord, UploadResponse } from '@chat-rag/shared'
import { useMemo, useState } from 'react'
import {
    deleteDocumentFn,
    updateDocumentFn,
    uploadDocumentFn,
} from '../lib/server/api'

interface UploadPanelProps {
  documents: DocumentRecord[]
  isLoadingDocuments: boolean
  documentsError: string | null
  onUploadComplete: (result: UploadResponse) => void
  onDocumentsReload: () => Promise<void>
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

export default function UploadPanel({
  documents,
  isLoadingDocuments,
  documentsError,
  onUploadComplete,
  onDocumentsReload,
}: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [deletingDocumentId, setDeletingDocumentId] = useState<string | null>(
    null,
  )
  const [updatingDocumentId, setUpdatingDocumentId] = useState<string | null>(
    null,
  )

  const acceptedDescription = useMemo(() => 'PDF or TXT up to 200 MB', [])
  const isMutatingDocuments =
    deletingDocumentId !== null || updatingDocumentId !== null

  function formatUploadedAt(uploadedAt: string): string {
    const parsedDate = new Date(uploadedAt)
    if (Number.isNaN(parsedDate.getTime())) {
      return 'Unknown upload time'
    }

    return parsedDate.toLocaleString()
  }

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
      await onDocumentsReload()

      setSuccessMessage(
        `Indexed ${result.filename} (${result.chunksStored} chunks).`,
      )
      setFile(null)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.'
      setErrorMessage(message)
    } finally {
      setIsUploading(false)
    }
  }

  async function handleDeleteDocument(document: DocumentRecord) {
    if (
      !window.confirm(`Remove ${document.filename} from indexed knowledge?`)
    ) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setDeletingDocumentId(document.id)

    try {
      await deleteDocumentFn({ data: { documentId: document.id } })
      await onDocumentsReload()
      setSuccessMessage(`Removed ${document.filename} from indexed knowledge.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to remove this file.'
      setErrorMessage(message)
    } finally {
      setDeletingDocumentId(null)
    }
  }

  async function handleUpdateDocument(
    document: DocumentRecord,
    selectedFile: File | null,
  ) {
    if (!selectedFile) {
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setUpdatingDocumentId(document.id)

    try {
      const formData = new FormData()
      formData.set('documentId', document.id)
      formData.set('file', selectedFile)

      const result = await updateDocumentFn({ data: formData })
      onUploadComplete(result)
      await onDocumentsReload()

      setSuccessMessage(`Updated ${document.filename} with ${result.filename}.`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to update this file.'
      setErrorMessage(message)
    } finally {
      setUpdatingDocumentId(null)
    }
  }

  return (
    <aside className="island-shell rise-in rounded-3xl p-5 sm:p-6">
      <p className="island-kicker mb-2">Documents</p>
      <h2 className="mb-2 text-xl font-bold text-[var(--sea-ink)]">
        Upload Knowledge Files
      </h2>
      <p className="mb-4 text-sm text-[var(--sea-ink-soft)]">
        Drop files here or pick one manually. The assistant answers only from
        indexed content.
      </p>

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
          onChange={(event) =>
            handleSelectedFile(event.target.files?.item(0) ?? null)
          }
        />
        <p className="mb-1 text-sm font-semibold text-[var(--sea-ink)]">
          Choose file
        </p>
        <p className="text-xs text-[var(--sea-ink-soft)]">
          {acceptedDescription}
        </p>
      </label>

      <div className="mt-4 rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-3">
        {file ? (
          <>
            <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
              {file.name}
            </p>
            <p className="m-0 text-xs text-[var(--sea-ink-soft)]">
              {formatFileSize(file.size)}
            </p>
          </>
        ) : (
          <p className="m-0 text-sm text-[var(--sea-ink-soft)]">
            No file selected.
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={!file || isUploading || isMutatingDocuments}
        onClick={handleUpload}
        className="mt-4 w-full rounded-xl border border-[var(--chip-line)] bg-[linear-gradient(90deg,#4fb8b2,#74cfb0)] px-4 py-2.5 text-sm font-semibold text-[#08363b] transition disabled:cursor-not-allowed disabled:opacity-45"
      >
        {isUploading ? 'Indexing document...' : 'Upload & Index'}
      </button>

      <div className="mt-5 rounded-2xl border border-[var(--line)] bg-[rgba(255,255,255,0.7)] p-3">
        <p className="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--sea-ink-soft)]">
          Indexed Files
        </p>

        {isLoadingDocuments ? (
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            Loading indexed files...
          </p>
        ) : null}

        {!isLoadingDocuments && documents.length === 0 ? (
          <p className="m-0 mt-2 text-sm text-[var(--sea-ink-soft)]">
            No indexed files yet.
          </p>
        ) : null}

        {!isLoadingDocuments && documents.length > 0 ? (
          <ul className="m-0 mt-2 list-none space-y-2 p-0">
            {documents.map((document) => {
              const isDeleting = deletingDocumentId === document.id
              const isUpdating = updatingDocumentId === document.id
              const isBusy = isDeleting || isUpdating

              return (
                <li
                  key={document.id}
                  className="rounded-xl border border-[var(--line)] bg-[rgba(255,255,255,0.76)] p-2.5"
                >
                  <p className="m-0 text-sm font-semibold text-[var(--sea-ink)]">
                    {document.filename}
                  </p>
                  <p className="m-0 mt-1 text-xs text-[var(--sea-ink-soft)]">
                    {document.chunksStored} chunks ·{' '}
                    {formatUploadedAt(document.uploadedAt)}
                  </p>

                  <div className="mt-2 flex gap-2">
                    <label
                      className={`inline-flex cursor-pointer items-center justify-center rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-xs font-semibold text-[var(--sea-ink-soft)] transition ${
                        isMutatingDocuments
                          ? 'cursor-not-allowed opacity-45'
                          : 'hover:border-[var(--chip-line)]'
                      }`}
                    >
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.txt,text/plain,application/pdf"
                        disabled={isMutatingDocuments}
                        onChange={(event) => {
                          const selectedFile =
                            event.target.files?.item(0) ?? null
                          event.currentTarget.value = ''
                          void handleUpdateDocument(document, selectedFile)
                        }}
                      />
                      {isUpdating ? 'Updating...' : 'Replace'}
                    </label>

                    <button
                      type="button"
                      disabled={isMutatingDocuments}
                      onClick={() => void handleDeleteDocument(document)}
                      className="rounded-lg border border-[rgba(153,43,43,0.24)] bg-[rgba(153,43,43,0.08)] px-2.5 py-1.5 text-xs font-semibold text-[#7a2a2a] transition hover:bg-[rgba(153,43,43,0.16)] disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isDeleting ? 'Removing...' : 'Remove'}
                    </button>

                    {isBusy ? (
                      <span className="inline-flex items-center text-xs text-[var(--sea-ink-soft)]">
                        Working...
                      </span>
                    ) : null}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>

      {documentsError ? (
        <p className="mt-3 rounded-xl border border-[rgba(153,43,43,0.24)] bg-[rgba(153,43,43,0.1)] px-3 py-2 text-xs text-[#7a2a2a]">
          {documentsError}
        </p>
      ) : null}

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
