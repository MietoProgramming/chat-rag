import { UploadResponse } from '@chat-rag/shared'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { Document } from '@langchain/core/documents'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import pdfParse from 'pdf-parse'

const COLLECTION_NAME = 'rag-documents'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-nomic-embed-text-v1.5'

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name)

  constructor(private readonly configService: ConfigService) {}

  async uploadDocument(file: Express.Multer.File): Promise<UploadResponse> {
    try {
      const text = await this.extractTextFromFile(file)
      if (text.trim().length === 0) {
        throw new BadRequestException('The uploaded file did not contain readable text.')
      }

      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: 1000,
        chunkOverlap: 200,
      })

      const baseMetadata = {
        source: file.originalname,
        uploadedAt: new Date().toISOString(),
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
        filename: file.originalname,
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
