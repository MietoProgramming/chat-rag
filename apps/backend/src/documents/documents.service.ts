import {
    DeleteDocumentResponse,
    ListDocumentsResponse,
    UploadResponse,
} from '@chat-rag/shared'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { Document } from '@langchain/core/documents'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import {
    BadRequestException,
    Injectable,
    InternalServerErrorException,
    Logger,
    NotFoundException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import {
    ChromaClient,
    type Collection,
    type Metadata,
    type Where,
} from 'chromadb'
import { randomUUID } from 'node:crypto'
import pdfParse from 'pdf-parse'

const COLLECTION_NAME = 'rag-documents'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-nomic-embed-text-v1.5'
const LEGACY_DOCUMENT_ID_PREFIX = 'legacy-'
const LIST_PAGE_SIZE = 500

interface UploadOptions {
  documentId?: string
}

interface IndexedChunkMetadata extends Metadata {
  source: string | null
  uploadedAt: string | null
  documentId: string | null
}

type DocumentMetadataKey = 'source' | 'uploadedAt' | 'documentId'

interface DocumentAccumulator {
  id: string
  filename: string
  uploadedAt: string
  chunksStored: number
  collectionName: string
  status: 'indexed'
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(private readonly configService: ConfigService) {}

  async uploadDocument(file: Express.Multer.File, options: UploadOptions = {}): Promise<UploadResponse> {
    try {
      const text = await this.extractTextFromFile(file)
      if (text.trim().length === 0) {
        throw new BadRequestException('The uploaded file did not contain readable text.')
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      })

      const documentId = options.documentId ?? this.createDocumentId()
      const uploadedAt = new Date().toISOString()
      const baseMetadata = {
        documentId,
        source: file.originalname,
        uploadedAt,
      }

      const splitDocuments = await splitter.createDocuments([text], [baseMetadata])
      const enrichedDocuments = splitDocuments.map((document, chunkIndex) => {
        return new Document({
          pageContent: document.pageContent,
          metadata: {
            ...document.metadata,
            chunkIndex,
          },
        })
      })

      const vectorStore = this.createVectorStore()
      await vectorStore.addDocuments(enrichedDocuments)

      return {
        id: documentId,
        filename: file.originalname,
        uploadedAt,
        chunksStored: enrichedDocuments.length,
        collectionName: COLLECTION_NAME,
        status: 'indexed',
      }
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error
      }

      this.logger.error('Failed to index uploaded document', error as Error)
      throw new InternalServerErrorException('Unable to process and index this document right now.')
    }
  }

  async listDocuments(): Promise<ListDocumentsResponse> {
    try {
      const collection = await this.getOrCreateCollection()
      const groups = new Map<string, DocumentAccumulator>()

      let offset = 0
      while (true) {
        const page = await collection.get<IndexedChunkMetadata>({
          include: ['metadatas'],
          limit: LIST_PAGE_SIZE,
          offset,
        })

        const pageSize = page.ids.length
        if (pageSize === 0) {
          break
        }

        for (let index = 0; index < pageSize; index += 1) {
          const metadata = page.metadatas[index]
          const filename = this.readMetadataString(metadata, 'source') ?? 'unknown-source'
          const uploadedAt = this.readMetadataString(metadata, 'uploadedAt') ?? new Date(0).toISOString()
          const documentId = this.readMetadataString(metadata, 'documentId') ?? this.toLegacyDocumentId(filename)

          const existing = groups.get(documentId)
          if (!existing) {
            groups.set(documentId, {
              id: documentId,
              filename,
              uploadedAt,
              chunksStored: 1,
              collectionName: COLLECTION_NAME,
              status: 'indexed',
            })
            continue
          }

          existing.chunksStored += 1
          if (this.parseTimestamp(uploadedAt) >= this.parseTimestamp(existing.uploadedAt)) {
            existing.uploadedAt = uploadedAt
            existing.filename = filename
          }
        }

        if (pageSize < LIST_PAGE_SIZE) {
          break
        }

        offset += pageSize
      }

      const documents = Array.from(groups.values()).sort((left, right) => {
        return this.parseTimestamp(right.uploadedAt) - this.parseTimestamp(left.uploadedAt)
      })

      return {
        documents,
        total: documents.length,
      }
    } catch (error) {
      this.logger.error('Failed to list indexed documents', error as Error)
      throw new InternalServerErrorException('Unable to list indexed documents right now.')
    }
  }

  async deleteDocument(documentId: string): Promise<DeleteDocumentResponse> {
    const normalizedId = this.normalizeDocumentId(documentId)

    try {
      const collection = await this.getOrCreateCollection()
      const where = this.buildWhereForDocumentId(normalizedId)
      const deletion = await collection.delete({ where })
      const deletedChunks = deletion.deleted ?? 0

      if (deletedChunks === 0) {
        throw new NotFoundException(`Document "${normalizedId}" was not found.`)
      }

      return {
        id: normalizedId,
        deletedChunks,
        status: 'deleted',
      }
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error
      }

      this.logger.error(`Failed to delete indexed document ${normalizedId}`, error as Error)
      throw new InternalServerErrorException('Unable to delete the document right now.')
    }
  }

  async updateDocument(documentId: string, file: Express.Multer.File): Promise<UploadResponse> {
    const normalizedId = this.normalizeDocumentId(documentId)
    const listing = await this.listDocuments()
    const existingDocument = listing.documents.find((document) => document.id === normalizedId)

    if (!existingDocument) {
      throw new NotFoundException(`Document "${normalizedId}" was not found.`)
    }

    await this.deleteDocument(normalizedId)

    const replacementId = this.fromLegacyDocumentId(normalizedId)
      ? this.createDocumentId()
      : normalizedId

    return this.uploadDocument(file, { documentId: replacementId })
  }

  private createVectorStore(): Chroma {
    const chromaUrl = this.configService.getOrThrow<string>('CHROMA_URL')
    const openAiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY')
    const openAiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL')
    const embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_EMBEDDING_MODEL

    return new Chroma(new OpenAIEmbeddings({
      model: embeddingModel,
      encodingFormat: 'float',
      apiKey: openAiKey,
      ...(openAiBaseUrl ? { configuration: { baseURL: openAiBaseUrl } } : {}),
    }), {
      collectionName: COLLECTION_NAME,
      url: chromaUrl,
    })
  }

  private createChromaClient(): ChromaClient {
    const chromaUrl = this.configService.getOrThrow<string>('CHROMA_URL')
    return new ChromaClient({ path: chromaUrl })
  }

  private async getOrCreateCollection(): Promise<Collection> {
    const client = this.createChromaClient()
    return client.getOrCreateCollection({ name: COLLECTION_NAME })
  }

  private createDocumentId(): string {
    return `doc-${randomUUID()}`
  }

  private normalizeDocumentId(documentId: string): string {
    const normalized = documentId.trim()
    if (normalized.length === 0) {
      throw new BadRequestException('Document id must not be empty.')
    }

    return normalized
  }

  private readMetadataString(
    metadata: IndexedChunkMetadata | null | undefined,
    key: DocumentMetadataKey,
  ): string | undefined {
    const value = metadata?.[key]
    if (typeof value !== 'string') {
      return undefined
    }

    const normalized = value.trim()
    return normalized.length > 0 ? normalized : undefined
  }

  private parseTimestamp(value: string): number {
    const timestamp = Date.parse(value)
    return Number.isNaN(timestamp) ? 0 : timestamp
  }

  private toLegacyDocumentId(filename: string): string {
    const encoded = Buffer.from(filename, 'utf-8').toString('base64url')
    return `${LEGACY_DOCUMENT_ID_PREFIX}${encoded}`
  }

  private fromLegacyDocumentId(documentId: string): string | null {
    if (!documentId.startsWith(LEGACY_DOCUMENT_ID_PREFIX)) {
      return null
    }

    const encodedFilename = documentId.slice(LEGACY_DOCUMENT_ID_PREFIX.length)
    try {
      const decoded = Buffer.from(encodedFilename, 'base64url').toString('utf-8').trim()
      return decoded.length > 0 ? decoded : null
    } catch {
      return null
    }
  }

  private buildWhereForDocumentId(documentId: string): Where {
    const legacyFilename = this.fromLegacyDocumentId(documentId)
    if (legacyFilename) {
      return { source: legacyFilename }
    }

    return { documentId }
  }

  private async extractTextFromFile(file: Express.Multer.File): Promise<string> {
    if (file.mimetype === 'text/plain') {
      return file.buffer.toString('utf-8')
    }

    if (file.mimetype === 'application/pdf') {
      const parsedPdf = await pdfParse(file.buffer)
      return parsedPdf.text ?? ''
    }

    throw new BadRequestException('Unsupported file format. Please upload a PDF or TXT file.')
  }
}
