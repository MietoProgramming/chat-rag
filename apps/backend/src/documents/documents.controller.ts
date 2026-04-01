import {
    DeleteDocumentResponse,
    ListDocumentsResponse,
    UploadResponse,
} from '@chat-rag/shared'
import {
    BadRequestException,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Put,
    UploadedFile,
    UseInterceptors,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { FileFilterCallback, memoryStorage } from 'multer'
import { DocumentsService } from './documents.service'

const ACCEPTED_MIME_TYPES = new Set(['application/pdf', 'text/plain'])
const FILE_FIELD_NAME = 'file'
const MAX_UPLOAD_FILE_SIZE_BYTES = 200 * 1024 * 1024

const FILE_INTERCEPTOR_OPTIONS = {
  storage: memoryStorage(),
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: FileFilterCallback,
  ) => {
    if (!ACCEPTED_MIME_TYPES.has(file.mimetype)) {
      callback(new BadRequestException('Only PDF and TXT files are supported.'))
      return
    }

    callback(null, true)
  },
}

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async listDocuments(): Promise<ListDocumentsResponse> {
    return this.documentsService.listDocuments()
  }

  @Post('upload')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor(FILE_FIELD_NAME, FILE_INTERCEPTOR_OPTIONS))
  async uploadDocument(@UploadedFile() file?: Express.Multer.File): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('A file must be provided with field name "file".')
    }

    return this.documentsService.uploadDocument(file)
  }

  @Delete(':documentId')
  @HttpCode(HttpStatus.OK)
  async deleteDocument(@Param('documentId') documentId: string): Promise<DeleteDocumentResponse> {
    return this.documentsService.deleteDocument(documentId)
  }

  @Put(':documentId')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor(FILE_FIELD_NAME, FILE_INTERCEPTOR_OPTIONS))
  async updateDocument(
    @Param('documentId') documentId: string,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<UploadResponse> {
    if (!file) {
      throw new BadRequestException('A file must be provided with field name "file".')
    }

    return this.documentsService.updateDocument(documentId, file)
  }
}
