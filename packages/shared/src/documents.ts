export interface DocumentRecord {
  id: string
  filename: string
  uploadedAt: string
  chunksStored: number
  collectionName: string
  status: 'indexed'
}

export interface UploadResponse extends DocumentRecord {}

export interface ListDocumentsResponse {
  documents: DocumentRecord[]
  total: number
}

export interface DeleteDocumentResponse {
  id: string
  deletedChunks: number
  status: 'deleted'
}
