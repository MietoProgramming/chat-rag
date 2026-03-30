export interface UploadResponse {
  filename: string
  chunksStored: number
  collectionName: string
  status: 'indexed'
}
