# chat-rag

Full-stack RAG Document Q&A app with:

- Frontend: TanStack Start + React + TypeScript
- Backend: Nest.js + LangChain + OpenAI
- Vector DB: ChromaDB (local Docker)

## Monorepo layout

- `apps/frontend`: TanStack Start app
- `apps/backend`: Nest.js API
- `packages/shared`: Shared TypeScript contracts

## Prerequisites

- Node.js 20+
- Bun 1.3+
- Docker + Docker Compose

## Setup

1. Copy env values:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
bun install
```

3. Start ChromaDB:

```bash
bun run infra:up
bun run infra:health
```

4. Start backend + frontend:

```bash
bun run dev
```

## API endpoints implemented

- `GET /api/health`
- `POST /api/documents/upload`
	- multipart/form-data with `file` field
	- accepts `application/pdf` and `text/plain`
- `POST /api/chat/message`
	- JSON payload: `{ "message": string, "history"?: { "role": "user" | "assistant", "content": string }[] }`
- `POST /api/chat/stream`
	- JSON payload matches `/api/chat/message`
	- streams NDJSON events: `sources`, `token`, `done`, `error`

## Current status

- Phase 1 complete: monorepo workspace, env template, Chroma Docker infra.
- Phase 2+3 started: Nest backend upload + retrieval chat endpoints implemented.
- Phase 4 started: TanStack Start BFF server functions and upload/chat UI implemented.
- Conversation history persists in browser local storage.
- Chat responses render citations from backend source metadata.
- Streaming chat is implemented end-to-end (backend NDJSON + frontend incremental rendering).
