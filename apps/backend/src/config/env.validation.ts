type RawEnv = Record<string, unknown>

interface AppEnv {
  OPENAI_API_KEY: string
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

export function validateEnv(env: RawEnv): AppEnv {
  const chromaUrl = readRequiredString(env, 'CHROMA_URL')
  readRequiredString(env, 'OPENAI_API_KEY')

  try {
    new URL(chromaUrl)
  } catch {
    throw new Error(`Invalid CHROMA_URL value: ${chromaUrl}`)
  }

  return {
    OPENAI_API_KEY: readRequiredString(env, 'OPENAI_API_KEY'),
    CHROMA_URL: chromaUrl,
    NEST_PORT: readPort(env, 'NEST_PORT', 3000),
    FRONTEND_PORT: readPort(env, 'FRONTEND_PORT', 5173),
  }
}
