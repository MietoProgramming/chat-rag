import { ChatResponse, ChatStreamEvent } from '@chat-rag/shared'
import { Body, Controller, HttpCode, HttpStatus, Post, Res } from '@nestjs/common'
import type { Response } from 'express'
import { ChatService } from './chat.service'
import { ChatMessageRequestDto } from './dto/chat-message.dto'

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Post('message')
  @HttpCode(HttpStatus.OK)
  async chat(@Body() body: ChatMessageRequestDto): Promise<ChatResponse> {
    return this.chatService.sendMessage(body)
  }

  @Post('stream')
  @HttpCode(HttpStatus.OK)
  async streamChat(
    @Body() body: ChatMessageRequestDto,
    @Res() response: Response,
  ): Promise<void> {
    response.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8')
    response.setHeader('Cache-Control', 'no-cache, no-transform')
    response.setHeader('Connection', 'keep-alive')
    response.flushHeaders?.()

    await this.chatService.streamMessage(body, (event: ChatStreamEvent) => {
      response.write(`${JSON.stringify(event)}\n`)
    })

    response.end()
  }
}
