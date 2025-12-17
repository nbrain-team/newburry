# Transcript Import Guide

## Status

- **Transcripts in CSV**: 1,502 records ✅
- **Database Ready**: meeting_transcripts table created ✅
- **Vectorization Ready**: Pinecone configured ✅
- **Import Script**: Created and ready ✅
- **Missing**: FATHOM_API_KEY ❌

## Steps to Import Transcripts

### 1. Add FATHOM_API_KEY to Render

Go to: https://dashboard.render.com/web/srv-d50uqqvfte5s739b7180/env

Add environment variable:
- **Key**: `FATHOM_API_KEY`
- **Value**: Your Fathom API key

Then click "Save, rebuild, and deploy"

### 2. Run Import Script

Once the FATHOM_API_KEY is added and the service redeploys, you have two options:

#### Option A: Via Local Machine (Recommended)

```bash
cd "/Users/dannydemichele/Newbury Partners/np/backend"

# Set environment variables (use your actual keys)
export DATABASE_URL="your-database-url-from-render"
export PINECONE_API_KEY="your-pinecone-key"
export PINECONE_INDEX_NAME="newburry"
export OPENAI_API_KEY="your-openai-key"
export FATHOM_API_KEY="your-fathom-key"

# Run import
node scripts/import-transcripts.js
```

#### Option B: Via Render Shell (Requires Paid Tier)

If you upgrade to Starter tier ($7/month), you can use Render Shell:

```bash
cd backend
node scripts/import-transcripts.js
```

### 3. Monitor Progress

The script will:
- Process transcripts in batches of 10
- Show progress for each batch
- Take approximately 30-45 minutes total
- Output: `X imported, Y skipped, Z errors`

### 4. Verify Import

After completion, check:

```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "https://newburry-backend.onrender.com/api/transcripts?limit=10"
```

Should return transcripts!

## What Gets Imported

For each transcript:
- ✅ Title
- ✅ Full transcript text
- ✅ Summary
- ✅ Participants
- ✅ Action items
- ✅ Topics
- ✅ Key questions
- ✅ Duration
- ✅ Date/time

## What Gets Vectorized

Each transcript is:
1. **Embedded** using OpenAI text-embedding-ada-002
2. **Indexed** to Pinecone with metadata:
   - source_type: 'transcript'
   - title, summary, client info
   - date, duration, participants count
   - Full searchable content (up to 35k chars)

## After Import

The AI agent will be able to:
- Search transcripts by content
- Find relevant meetings semantically
- Extract action items
- Analyze discussions
- Answer questions about past meetings

## Estimated Costs

- **Fathom API**: 1,502 calls (check your Fathom plan limits)
- **OpenAI Embeddings**: ~$0.50 (1,502 × $0.0001 per 1k tokens)
- **Pinecone**: Free tier supports 100k vectors (we're using 1,502)

## Troubleshooting

### If import fails:
1. Check FATHOM_API_KEY is valid
2. Check Fathom API rate limits
3. Review error messages in output
4. Try smaller batch size (edit BATCH_SIZE in script)

### If vectorization fails:
1. Verify PINECONE_API_KEY
2. Check Pinecone index exists (name: "newburry")
3. Verify OPENAI_API_KEY is valid
4. Check Pinecone dashboard for errors

## Next Steps After Import

1. Test AI agent: "Show me recent transcripts"
2. Test search: "Find meetings about Bullhorn"
3. Test analysis: "Analyze the most recent Newbury Partners meeting"
4. Verify vector search works with semantic queries

---

**Ready to import!** Just need the FATHOM_API_KEY.

