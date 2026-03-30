import { createFileRoute } from '@tanstack/react-router'
import { buildBackendUrl } from '../../../lib/server/backend-url'

async function readBackendError(response: Response): Promise<string> {
  try {
    const payload = (await response.json()) as {
      message?: string | string[]
      error?: string
    }

    if (Array.isArray(payload.message)) {
      return payload.message.join(', ')
    }

    if (typeof payload.message === 'string' && payload.message.length > 0) {
      return payload.message
    }

    if (typeof payload.error === 'string' && payload.error.length > 0) {
      return payload.error
    }
  } catch {
    const text = await response.text()
    if (text.length > 0) {
      return text
    }
  }

  return `Request failed with status ${response.status}`
}

export const Route = createFileRoute('/api/chat/stream')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const requestBody = await request.text()
        const backendResponse = await fetch(buildBackendUrl('/api/chat/stream'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
        })

        if (!backendResponse.ok || !backendResponse.body) {
          const errorMessage = await readBackendError(backendResponse)
          const status = backendResponse.status > 0 ? backendResponse.status : 502
          return new Response(
            JSON.stringify({
              message: errorMessage,
            }),
            {
              status,
              headers: {
                'Content-Type': 'application/json',
              },
            },
          )
        }

        return new Response(backendResponse.body, {
          status: backendResponse.status,
          headers: {
            'Content-Type': 'application/x-ndjson; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
          },
        })
      },
    },
  },
})
