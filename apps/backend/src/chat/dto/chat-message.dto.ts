import type { ChatRole } from '@chat-rag/shared'
import { Type } from 'class-transformer'
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsString, ValidateNested } from 'class-validator'

export class ChatHistoryItemDto {
  @IsIn(['user', 'assistant'])
  role!: ChatRole

  @IsString()
  @IsNotEmpty()
  content!: string
}

export class ChatMessageRequestDto {
  @IsString()
  @IsNotEmpty()
  message!: string

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryItemDto)
  @IsOptional()
  history?: ChatHistoryItemDto[]
}
