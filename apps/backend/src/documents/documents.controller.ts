import { UploadResponse } from '@chat-rag/shared'
import {
    BadRequestException,
    Controller,
    HttpCode,
    HttpStatus,
    Post,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { DocumentsService } from './documents.service'

const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'text/plain'])

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: {
        fileSize: 10 * 1024 * 1024,
      },
      fileFilter: (_request, file, callback) => {
        if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
          callback(
            new BadRequestException('Only PDF and TXT files are supported.'),
            false,
          )
          return
        }

        callback(null, true)
      },
    }),
  )
  async uploadDocument(@UploadedFile() file?: Express.Multer.File): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('A file must be provided with field name "file".')
    }

    return this.documentsService.uploadDocument(file)
  }
}
