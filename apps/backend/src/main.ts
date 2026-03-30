import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  app.setGlobalPrefix('api')
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  )

  const frontendPort = process.env.FRONTEND_PORT ?? '5173'
  app.enableCors({
    origin: process.env.FRONTEND_ORIGIN ?? `http://localhost:${frontendPort}`,
    credentials: true,
  })

  const port = Number(process.env.NEST_PORT ?? 3000)
  await app.listen(port)
}

void bootstrap()
