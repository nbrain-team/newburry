# Newburry Platform - Backend

AI-powered transcript analysis and knowledge management system for Newbury Partners.

Built on nBrain's Agentic AI Brain architecture.

## Features

- 🤖 **AI Agent Chat**: Intelligent assistant powered by Gemini/Claude
- 📝 **Transcript Analysis**: Deep analysis of 1500+ Fathom meeting recordings
- 🔍 **Semantic Search**: Vector search across all transcripts and knowledge base
- 💬 **Real-time Chat**: WebSocket-powered streaming responses
- 🎯 **Action Item Extraction**: Automated extraction of commitments and follow-ups
- 📊 **Knowledge Base**: Pinecone-powered vector database

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: PostgreSQL (via Render)
- **Vector DB**: Pinecone
- **AI Models**: 
  - Google Gemini (orchestration)
  - Claude Opus (transcript analysis)
  - OpenAI (embeddings)
- **Real-time**: Socket.io
- **ORM**: Prisma

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment Variables

Create a `.env` file in the backend directory:

```env
# Database (from Render)
DATABASE_URL=postgresql://user:pass@host/db
DATABASE_SSL=true

# JWT
JWT_SECRET=your-secret-key

# AI APIs
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key
ANTHROPIC_API_KEY=your-anthropic-key

# Pinecone
PINECONE_API_KEY=your-pinecone-key
PINECONE_INDEX_NAME=newburry
PINECONE_ENVIRONMENT=us-east-1

# Fathom (for transcript import)
FATHOM_API_KEY=your-fathom-key

# Client
CLIENT_NAME=Newbury Partners
CLIENT_ID=newbury

# Frontend
FRONTEND_URL=https://newburry-frontend.onrender.com

# Server
PORT=3001
NODE_ENV=production
```

### 3. Run Migrations

Migrations run automatically on server start, but you can also run them manually:

```bash
node server.js
```

### 4. Import Transcripts

After the database is set up, import the 1500+ transcripts:

```bash
node scripts/import-transcripts.js
```

This will:
- Read `transcripts_list.csv`
- Fetch full transcript data from Fathom API
- Save to PostgreSQL
- Vectorize and index to Pinecone

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### AI Agent Chat

- `POST /api/agent-chat/sessions` - Create new chat session
- `GET /api/agent-chat/sessions` - Get all sessions
- `GET /api/agent-chat/sessions/:id` - Get session with messages
- `POST /api/agent-chat/sessions/:id/message` - Send message (streaming)
- `PUT /api/agent-chat/sessions/:id` - Update session
- `DELETE /api/agent-chat/sessions/:id` - Delete session

### Transcripts

- `GET /api/transcripts` - Get all transcripts (paginated)
- `GET /api/transcripts/:id` - Get single transcript
- `POST /api/transcripts/search` - Search transcripts

### Health

- `GET /ping` - Simple health check
- `GET /health` - Detailed health check with database status

## AI Agent Tools

The agent has access to these tools:

- **search_transcripts**: Search meeting transcripts by content
- **get_recent_transcripts**: Get most recent meetings
- **analyze_transcript_deeply**: Deep multi-pass transcript analysis
- **vector_search**: Semantic search across knowledge base

## Architecture

```
┌─────────────────────────────────────────┐
│         User Interface (Frontend)       │
└─────────────────┬───────────────────────┘
                  │ HTTP/WebSocket
┌─────────────────▼───────────────────────┐
│         Express Server (server.js)      │
│  ┌─────────────────────────────────┐   │
│  │   AgenticOrchestrator           │   │
│  │   - Query understanding         │   │
│  │   - Plan generation             │   │
│  │   - Tool execution              │   │
│  │   - Response synthesis          │   │
│  └─────────────┬───────────────────┘   │
│                │                         │
│  ┌─────────────▼───────────────────┐   │
│  │   ToolRegistry                  │   │
│  │   - search_transcripts          │   │
│  │   - vector_search               │   │
│  │   - analyze_transcript_deeply   │   │
│  └─────────────────────────────────┘   │
└─────────────────┬───────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
┌───────▼────────┐  ┌──────▼────────┐
│   PostgreSQL   │  │   Pinecone    │
│   (Transcripts)│  │   (Vectors)   │
└────────────────┘  └───────────────┘
```

## Development

```bash
# Start server
npm start

# The server will:
# 1. Connect to PostgreSQL
# 2. Run migrations automatically
# 3. Initialize AI agent system
# 4. Load tools from /tools directory
# 5. Start Express + WebSocket server
```

## Deployment

The backend is configured for Render deployment:

1. Push to GitHub
2. Render automatically detects changes
3. Runs `npm install` (build command)
4. Runs `npm start` (start command)
5. Environment variables are pre-configured in Render

## License

Proprietary - Newbury Partners


