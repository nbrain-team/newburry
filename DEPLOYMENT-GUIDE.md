# Newburry Platform - Deployment Guide

## 🎉 Setup Complete!

The Newburry platform backend has been successfully built and is ready for deployment.

## ✅ What Has Been Built

### Backend Architecture (Adapted from nBrain)

1. **AI Agent System**
   - `services/orchestrator.js` - Main AI orchestrator (Gemini/Claude)
   - `services/toolRegistry.js` - Tool management system
   - `services/websocket.js` - Real-time WebSocket communication
   - `services/transcriptIndexer.js` - Pinecone vectorization

2. **AI Tools** (4 core tools)
   - `tools/search_transcripts.js` - Full-text search across transcripts
   - `tools/get_recent_transcripts.js` - Get recent meetings
   - `tools/analyze_transcript_deeply.js` - Multi-pass deep analysis
   - `tools/vectorSearchTool.js` - Semantic search via Pinecone

3. **API Endpoints**
   - Authentication (register, login, me)
   - AI Agent Chat (sessions, messages with streaming)
   - Transcripts (list, search, view)
   - Health checks

4. **Database Schema**
   - Agent chat sessions & messages
   - User preferences & feedback
   - Meeting transcripts (1500+ from Fathom)
   - Prisma ORM configured for PostgreSQL

5. **Scripts**
   - `scripts/import-transcripts.js` - Import 1500+ transcripts from CSV
   - Automatic vectorization to Pinecone

## 🔧 Render Services Configured

### 1. newburry-backend (Web Service)
- **URL**: https://newburry-backend.onrender.com
- **Tier**: Free (512 MB RAM, 0.1 CPU)
- **Runtime**: Node.js
- **Build**: `npm install`
- **Start**: `npm start`

**Environment Variables Configured:**
- ✅ DATABASE_URL (auto-configured by Render)
- ✅ OPENAI_API_KEY
- ✅ GEMINI_API_KEY  
- ✅ ANTHROPIC_API_KEY
- ✅ PINECONE_API_KEY
- ✅ PINECONE_INDEX_NAME (newburry)
- ✅ JWT_SECRET
- ✅ CLIENT_NAME (Newbury Partners)
- ✅ CLIENT_ID (newbury)

### 2. newburry-frontend (Static Site)
- **URL**: https://newburry-frontend.onrender.com
- **Tier**: Free (Global CDN)
- **Environment Variables:**
  - ✅ REACT_APP_API_URL (https://newburry-backend.onrender.com)

### 3. newburry-db (PostgreSQL)
- **Tier**: Free (256 MB RAM, 1 GB Storage)
- **Connection**: Internal (dpg-d50umuer433s739umkf0-a)
- **Database**: newburry_db
- **User**: newburry_db_user

## 📦 Files Created

```
np/
├── backend/
│   ├── config/
│   │   └── client-config.js          # Newbury-specific configuration
│   ├── migrations/
│   │   ├── 001_create_agentic_ai_brain_tables.sql
│   │   └── 030_create_meeting_transcripts.sql
│   ├── routes/
│   │   └── index.js                  # AI agent API routes
│   ├── services/
│   │   ├── orchestrator.js           # Main AI orchestrator
│   │   ├── toolRegistry.js           # Tool management
│   │   ├── transcriptIndexer.js      # Pinecone indexing
│   │   └── websocket.js              # Real-time communication
│   ├── tools/
│   │   ├── search_transcripts.js     # Transcript search
│   │   ├── get_recent_transcripts.js # Recent meetings
│   │   ├── analyze_transcript_deeply.js # Deep analysis
│   │   └── vectorSearchTool.js       # Semantic search
│   ├── utils/
│   │   └── transcriptAnalysisValidator.js
│   ├── scripts/
│   │   └── import-transcripts.js     # Import 1500+ transcripts
│   ├── server.js                     # Main server
│   ├── package.json
│   └── README.md
├── prisma/
│   └── schema.prisma                 # PostgreSQL schema (updated)
├── transcripts_list.csv              # 1502 Fathom transcripts
├── .gitignore
├── package.json
└── README.md
```

## 🚀 Deployment Steps

### Step 1: Push to GitHub

Once you've set up the deploy key:

```bash
cd "/Users/dannydemichele/Newbury Partners/np"
git push -u origin main
```

### Step 2: Render Auto-Deployment

Render will automatically:
1. Detect the push to GitHub
2. Run `npm install` in the backend directory
3. Start the server with `npm start`
4. Run migrations automatically on startup
5. Initialize the AI agent system

### Step 3: Import Transcripts

After deployment is successful, run the import script via Render Shell:

```bash
# Option A: Via Render Shell (in browser)
cd backend
node scripts/import-transcripts.js

# Option B: Via API endpoint (to be added)
curl -X POST https://newburry-backend.onrender.com/api/admin/import-transcripts
```

**Note**: You'll need to add `FATHOM_API_KEY` to environment variables before importing.

## 🧪 Testing After Deployment

### 1. Health Check
```bash
curl https://newburry-backend.onrender.com/ping
# Expected: "pong"

curl https://newburry-backend.onrender.com/health
# Expected: {"status":"healthy","database":"connected","timestamp":"..."}
```

### 2. Test Authentication
```bash
# Register a test user
curl -X POST https://newburry-backend.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@newbury.com",
    "username": "testuser",
    "password": "testpass123",
    "role": "admin"
  }'
```

### 3. Test AI Agent Chat

Use the browser to test the full agent chat functionality via the Render dashboard or use the browser tools to navigate to the backend URL.

## 📊 Data Import Plan

### Transcripts (1502 records)

The `transcripts_list.csv` contains:
- Recording ID
- Title
- Date Created
- Fathom URL

The import script will:
1. Read each record from CSV
2. Fetch full transcript data from Fathom API (requires `FATHOM_API_KEY`)
3. Extract:
   - Transcript text
   - Participants
   - Summary
   - Action items
   - Topics
   - Key questions
4. Save to PostgreSQL `meeting_transcripts` table
5. Create embeddings using OpenAI
6. Index to Pinecone for semantic search

**Estimated Time**: 
- With batch processing (10 at a time): ~30-45 minutes
- Total API calls to Fathom: 1502
- Total embeddings to create: 1502
- Total Pinecone upserts: 1502

## 🔑 Missing Environment Variables

To complete the setup, you'll need to add:

### Backend Service
- `FATHOM_API_KEY` - Required for transcript import
- `FRONTEND_URL` - Optional (already set to https://newburry-frontend.onrender.com)
- `PINECONE_ENVIRONMENT` - Optional (defaults to us-east-1)

## 🎯 Next Steps After Deployment

1. **Verify Backend is Running**
   - Check https://newburry-backend.onrender.com/ping
   - Check https://newburry-backend.onrender.com/health

2. **Add FATHOM_API_KEY**
   - Go to Render dashboard → newburry-backend → Environment
   - Add `FATHOM_API_KEY` with your Fathom API key

3. **Import Transcripts**
   - Run the import script via Render Shell
   - Monitor progress in Logs tab

4. **Test AI Agent**
   - Create a test user via API
   - Create a chat session
   - Send a message: "Show me recent transcripts"
   - Verify the agent can search and analyze transcripts

5. **Build Frontend** (Next Phase)
   - Create Next.js frontend with chat interface
   - Connect to backend API
   - Deploy to newburry-frontend service

## 📝 Important Notes

### Free Tier Limitations
- Backend spins down after inactivity (50+ second cold start)
- Database expires January 15, 2026 (upgrade to keep)
- No SSH access on free tier

### Database Connection
- Internal URL (for backend): `dpg-d50umuer433s739umkf0-a`
- Port: 5432
- Database: `newburry_db`
- User: `newburry_db_user`

### Pinecone Index
- Name: `newburry`
- Dimensions: 768 (for text-embedding-ada-002)
- Region: us-east-1

## 🐛 Troubleshooting

### If deployment fails:

1. **Check Logs**
   - Render Dashboard → newburry-backend → Logs
   - Look for error messages during startup

2. **Common Issues**
   - Missing environment variables
   - Database connection timeout
   - Migration errors

3. **Test Database Connection**
   ```bash
   # Via Render Shell
   node -e "const {Pool}=require('pg'); const p=new Pool({connectionString:process.env.DATABASE_URL,ssl:{rejectUnauthorized:false}}); p.query('SELECT NOW()').then(r=>console.log('DB OK:',r.rows[0])).catch(e=>console.error('DB Error:',e.message)).finally(()=>p.end())"
   ```

### If transcripts don't import:

1. Verify `FATHOM_API_KEY` is set
2. Check Fathom API rate limits
3. Review import script logs
4. Try importing in smaller batches

## 🎓 Architecture Overview

```
User Request
     ↓
Express Server (server.js)
     ↓
AI Agent Routes (/api/agent-chat/*)
     ↓
AgenticOrchestrator
     ↓
1. Generate Execution Plan (Gemini)
2. Execute Tools (ToolRegistry)
   - search_transcripts → PostgreSQL
   - vector_search → Pinecone
   - analyze_transcript_deeply → Claude Opus
3. Synthesize Response (Gemini/Claude)
     ↓
Stream Response via WebSocket/SSE
     ↓
User Receives Answer
```

## 📚 Key Features Implemented

✅ AI Agent Chat with streaming responses
✅ Multi-pass transcript analysis
✅ Semantic search via Pinecone
✅ Full-text search via PostgreSQL
✅ Real-time WebSocket communication
✅ JWT authentication
✅ Automatic migrations
✅ Tool registry system
✅ User preferences & learning
✅ Feedback system

## 🔐 Security Notes

- All API keys are stored as environment variables in Render
- JWT tokens for authentication
- Database SSL enabled
- CORS configured for frontend domain
- Passwords hashed with bcrypt

## 📞 Support

For deployment issues, check:
1. Render Dashboard Logs
2. GitHub Actions (if configured)
3. Database connection status
4. Environment variables are all set

---

**Status**: ✅ Ready for GitHub push and deployment
**Last Updated**: December 16, 2025

