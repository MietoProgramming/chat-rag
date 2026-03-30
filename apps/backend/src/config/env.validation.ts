type RawEnv = Record<string, unknown>

interface AppEnv {
  OPENAI_API_KEY: string
  OPENAI_BASE_URL?: string
  OPENAI_CHAT_MODEL?: string
  OPENAI_EMBEDDING_MODEL?: string
  CHROMA_URL: string
  NEST_PORT: number
  FRONTEND_PORT: number
}

function readRequiredString(env: RawEnv, key: keyof AppEnv): string {
  const value = env[key]
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${key}`)
  }

  return value
}

function readPort(env: RawEnv, key: 'NEST_PORT' | 'FRONTEND_PORT', fallback: number): number {
  const rawValue = env[key]
  if (rawValue == null || rawValue === '') {
    return fallback
  }

  const numericValue = Number(rawValue)
  if (!Number.isInteger(numericValue) || numericValue <= 0 || numericValue > 65535) {
    throw new Error(`Invalid ${key} value: ${String(rawValue)}`)
  }

  return numericValue
}

function readOptionalUrl(env: RawEnv, key: 'OPENAI_BASE_URL'): string | undefined {
  const value = env[key]
  if (value == null || value === '') {
    return undefined
  }

  if (typeof value !== 'string') {
    throw new Error(`Invalid ${key} value: ${String(value)}`)
  }

  try {
    const parsedUrl = new URL(value)
    const trimmedPath = parsedUrl.pathname.replace(/\/+$/, '')
    parsedUrl.pathname = trimmedPath === '' || trimmedPath === '/' ? '/v1' : trimmedPath

    return parsedUrl.toString().replace(/\/$/, '')
  } catch {
    throw new Error(`Invalid ${key} value: ${value}`)
  }
}

function readOptionalString(
  env: RawEnv,
  key: 'OPENAI_CHAT_MODEL' | 'OPENAI_EMBEDDING_MODEL',
): string | undefined {
  const value = env[key]
  if (value == null || value === '') {
    return undefined
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${key} value: ${String(value)}`)
  }

  return value
}

export function validateEnv(env: RawEnv): AppEnv {
  const chromaUrl = readRequiredString(env, 'CHROMA_URL')
  const openAiBaseUrl = readOptionalUrl(env, 'OPENAI_BASE_URL')
  const openAiChatModel = readOptionalString(env, 'OPENAI_CHAT_MODEL')
  const openAiEmbeddingModel = readOptionalString(env, 'OPENAI_EMBEDDING_MODEL')
  readRequiredString(env, 'OPENAI_API_KEY')

  try {
    new URL(chromaUrl)
  } catch {
    throw new Error(`Invalid CHROMA_URL value: ${chromaUrl}`)
  }

  return {
    OPENAI_API_KEY: readRequiredString(env, 'OPENAI_API_KEY'),
    OPENAI_BASE_URL: openAiBaseUrl,
    OPENAI_CHAT_MODEL: openAiChatModel,
    OPENAI_EMBEDDING_MODEL: openAiEmbeddingModel,
    CHROMA_URL: chromaUrl,
    NEST_PORT: readPort(env, 'NEST_PORT', 3000),
    FRONTEND_PORT: readPort(env, 'FRONTEND_PORT', 5173),
  }
}
