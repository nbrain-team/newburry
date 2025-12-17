# Newburry Platform

AI-powered transcript analysis and knowledge management system for Newbury Partners.

## Overview

Newburry is an intelligent platform that analyzes 1500+ meeting transcripts from Fathom, providing:
- AI-powered transcript search and analysis
- Automated action item extraction
- Semantic knowledge search
- Real-time AI agent assistance

Built on nBrain's proven Agentic AI Brain architecture.

## Architecture

- **Backend**: Node.js + Express + PostgreSQL + Pinecone
- **Frontend**: Next.js + React (coming soon)
- **AI**: Google Gemini + Claude Opus + OpenAI
- **Deployment**: Render (backend, frontend, database)

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL database (provided by Render)
- Pinecone account
- OpenAI API key
- Fathom API key (for transcript import)

### Installation

```bash
# Install all dependencies
npm run install:all

# Or install individually
npm run backend:install
npm run frontend:install
```

### Configuration

1. Set up environment variables in `backend/.env` (see `backend/.env.example`)
2. Configure Render services with the same environment variables

### Running Locally

```bash
# Start backend
npm run backend

# Start frontend (in another terminal)
npm run frontend
```

### Import Transcripts

After the backend is running:

```bash
npm run import:transcripts
```

This will:
1. Read `transcripts_list.csv` (1500+ records)
2. Fetch full transcript data from Fathom API
3. Save to PostgreSQL database
4. Vectorize and index to Pinecone for semantic search

## Deployment

### Render Services

The platform is deployed on Render with 3 services:

1. **newburry-backend** (Web Service)
   - URL: https://newburry-backend.onrender.com
   - Free tier: 512 MB RAM, 0.1 CPU
   - Auto-deploys from GitHub `main` branch

2. **newburry-frontend** (Static Site)
   - URL: https://newburry-frontend.onrender.com
   - Global CDN
   - Auto-deploys from GitHub `main` branch

3. **newburry-db** (PostgreSQL)
   - Free tier: 256 MB RAM, 1 GB storage
   - Internal connection for backend

### Environment Variables (Render)

All environment variables are pre-configured in Render:
- `DATABASE_URL` - Automatically set by Render
- `PINECONE_API_KEY` - Configured
- `PINECONE_INDEX_NAME` - Set to "newburry"
- `OPENAI_API_KEY` - Configured

### Deploy to GitHub

```bash
# Initialize git (if not already)
git init

# Add remote
git remote add origin https://github.com/nbrain-team/newburry.git

# Commit and push
git add .
git commit -m "Initial Newburry platform setup"
git push -u origin main
```

Render will automatically detect the push and deploy.

## Project Structure

```
np/
├── backend/                 # Node.js backend
│   ├── config/             # Configuration files
│   ├── migrations/         # Database migrations
│   ├── routes/             # API routes
│   ├── services/           # Core services (orchestrator, etc.)
│   ├── tools/              # AI agent tools
│   ├── utils/              # Utility functions
│   ├── scripts/            # Import/maintenance scripts
│   ├── server.js           # Main server file
│   └── package.json
├── prisma/                 # Prisma ORM
│   └── schema.prisma       # Database schema
├── transcripts_list.csv    # 1500+ Fathom transcripts
├── scripts/                # Data import scripts
└── package.json            # Root package.json
```

## Key Features

### AI Agent Chat

The AI agent can:
- Search across all 1500+ transcripts
- Extract action items and commitments
- Identify key decisions and topics
- Provide context-aware insights
- Stream responses in real-time

### Transcript Analysis

Multi-pass deep analysis:
1. Extract explicit action items
2. Find implicit commitments
3. Identify decisions and topics
4. Verification pass to catch missed items

### Vector Search

Semantic search powered by Pinecone:
- Find relevant transcripts by meaning, not just keywords
- Search across all meeting content
- Confidence-scored results

## API Documentation

See [backend/README.md](backend/README.md) for detailed API documentation.

## Support

For issues or questions, contact the Newbury Partners team.

## License

Proprietary - Newbury Partners
