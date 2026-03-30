import { ChatResponse, ChatStreamEvent } from '@chat-rag/shared'
import { Chroma } from '@langchain/community/vectorstores/chroma'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts'
import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai'
import {
  Injectable,
  InternalServerErrorException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { ChatHistoryItemDto, ChatMessageRequestDto } from './dto/chat-message.dto'

const COLLECTION_NAME = 'rag-documents'
const NO_CONTEXT_ANSWER =
  'I could not find relevant information in the uploaded documents to answer that question.'
const DEFAULT_CHAT_MODEL = 'qwen/qwen3-8b'
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-nomic-embed-text-v1.5'

interface PromptInput {
  context: string
  history: Array<HumanMessage | AIMessage>
  question: string
  sources: ChatResponse['sources']
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name)

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(payload: ChatMessageRequestDto): Promise<ChatResponse> {
    try {
      const promptInput = await this.buildPromptInput(payload)

      if (promptInput.sources.length === 0) {
        return { answer: NO_CONTEXT_ANSWER, sources: [] }
      }

      const chain = this.createPrompt().pipe(this.createChatModel())
      const response = await chain.invoke({
        context: promptInput.context,
        history: promptInput.history,
        question: promptInput.question,
      })

      const answer = this.extractMessageContent(response.content).trim()

      return {
        answer: answer.length > 0 ? answer : NO_CONTEXT_ANSWER,
        sources: promptInput.sources,
      }
    } catch (error) {
      this.throwChatError(error)
    }
  }

  async streamMessage(
    payload: ChatMessageRequestDto,
    onEvent: (event: ChatStreamEvent) => Promise<void> | void,
  ): Promise<void> {
    try {
      const promptInput = await this.buildPromptInput(payload)
      await onEvent({ type: 'sources', sources: promptInput.sources })

      if (promptInput.sources.length === 0) {
        await onEvent({ type: 'token', token: NO_CONTEXT_ANSWER })
        await onEvent({ type: 'done' })
        return
      }

      const chain = this.createPrompt().pipe(this.createChatModel())
      const stream = await chain.stream({
        context: promptInput.context,
        history: promptInput.history,
        question: promptInput.question,
      })

      for await (const chunk of stream) {
        const token = this.extractMessageContent(chunk.content)
        if (token.length > 0) {
          await onEvent({ type: 'token', token })
        }
      }

      await onEvent({ type: 'done' })
    } catch (error) {
      await onEvent({ type: 'error', message: this.toClientErrorMessage(error) })
    }
  }

  private createVectorStore(): Chroma {
    const openAiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL')
    const embeddingModel =
      this.configService.get<string>('OPENAI_EMBEDDING_MODEL') ?? DEFAULT_EMBEDDING_MODEL

    return new Chroma(
      new OpenAIEmbeddings({
        model: embeddingModel,
        encodingFormat: 'float',
        apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
        ...(openAiBaseUrl ? { configuration: { baseURL: openAiBaseUrl } } : {}),
      }),
      {
        collectionName: COLLECTION_NAME,
        url: this.configService.getOrThrow<string>('CHROMA_URL'),
      },
    )
  }

  private async buildPromptInput(payload: ChatMessageRequestDto): Promise<PromptInput> {
    const vectorStore = this.createVectorStore()
    const retrievedChunks = await vectorStore.similaritySearch(payload.message, 4)

    return {
      context: this.buildContext(retrievedChunks),
      history: this.mapHistory(payload.history ?? []),
      question: payload.message,
      sources: this.extractSources(retrievedChunks),
    }
  }

  private createPrompt(): ChatPromptTemplate {
    return ChatPromptTemplate.fromMessages([
      [
        'system',
        [
          'You are a strict document Q&A assistant.',
          'Answer the user question using only the provided context.',
          'If the context does not contain the answer, explicitly say you cannot answer from the uploaded documents.',
          'Do not invent facts or use external knowledge.',
          'Context:',
          '{context}',
        ].join('\n'),
      ],
      new MessagesPlaceholder('history'),
      ['human', '{question}'],
    ])
  }

  private createChatModel(): ChatOpenAI {
    const openAiBaseUrl = this.configService.get<string>('OPENAI_BASE_URL')
    const chatModel = this.configService.get<string>('OPENAI_CHAT_MODEL') ?? DEFAULT_CHAT_MODEL

    return new ChatOpenAI({
      model: chatModel,
      temperature: 0,
      apiKey: this.configService.getOrThrow<string>('OPENAI_API_KEY'),
      ...(openAiBaseUrl ? { configuration: { baseURL: openAiBaseUrl } } : {}),
    })
  }

  private buildContext(chunks: Array<{ pageContent: string; metadata?: Record<string, unknown> }>): string {
    return chunks
      .map((chunk, index) => {
        return `Chunk ${index + 1} (source: ${String(chunk.metadata?.source ?? 'unknown')}):\n${chunk.pageContent}`
      })
      .join('\n\n')
  }

  private mapHistory(history: ChatHistoryItemDto[]): Array<HumanMessage | AIMessage> {
    return history.map((item) => {
      if (item.role === 'assistant') {
        return new AIMessage(item.content)
      }

      return new HumanMessage(item.content)
    })
  }

  private extractMessageContent(content: unknown): string {
    if (typeof content === 'string') {
      return content
    }

    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === 'string') {
            return part
          }

          if (part && typeof part === 'object' && 'text' in part) {
            const typedPart = part as { text?: unknown }
            return typeof typedPart.text === 'string' ? typedPart.text : ''
          }

          return ''
        })
        .join('')
    }

    return ''
  }

  private extractSources(
    chunks: Array<{ metadata?: Record<string, unknown> }>,
  ): ChatResponse['sources'] {
    const sourceMap = new Map<string, ChatResponse['sources'][number]>()

    for (const chunk of chunks) {
      const source =
        typeof chunk.metadata?.source === 'string' ? chunk.metadata.source : 'unknown-source'
      const chunkIndex =
        typeof chunk.metadata?.chunkIndex === 'number' ? chunk.metadata.chunkIndex : undefined
      const key = `${source}:${chunkIndex ?? 'na'}`

      if (!sourceMap.has(key)) {
        sourceMap.set(key, { source, chunkIndex })
      }
    }

    return Array.from(sourceMap.values())
  }

  private throwChatError(error: unknown): never {
    const message = error instanceof Error ? error.message : 'Unknown chat failure'
    this.logger.error(`Chat request failed: ${message}`)

    if (this.isChromaFailure(message)) {
      throw new ServiceUnavailableException('Vector store is unavailable right now.')
    }

    throw new InternalServerErrorException('Unable to generate a response right now.')
  }

  private toClientErrorMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : 'Unknown chat failure'
    this.logger.error(`Streaming chat request failed: ${message}`)

    if (this.isChromaFailure(message)) {
      return 'Vector store is unavailable right now.'
    }

    return 'Unable to generate a response right now.'
  }

  private isChromaFailure(message: string): boolean {
    return message.toLowerCase().includes('chroma')
  }
}
