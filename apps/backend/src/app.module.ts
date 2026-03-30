import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { ChatModule } from './chat/chat.module'
import { validateEnv } from './config/env.validation'
import { DocumentsModule } from './documents/documents.module'
import { HealthController } from './health/health.controller'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
      validate: validateEnv,
    }),
    DocumentsModule,
    ChatModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}
