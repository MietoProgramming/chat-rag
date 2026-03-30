export function resolveBackendBaseUrl(): string {
  const explicitUrl = process.env.NEST_API_URL
  if (explicitUrl && explicitUrl.length > 0) {
    return explicitUrl
  }

  const backendPort = process.env.NEST_PORT ?? '3000'
  return `http://localhost:${backendPort}`
}

export function buildBackendUrl(path: string): string {
  const base = resolveBackendBaseUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}
