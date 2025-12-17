// ============================================================================
// Service: Transcript Indexer
// Purpose: Index meeting transcripts to Pinecone for AI search
// ============================================================================

const { Pinecone } = require('@pinecone-database/pinecone');
const OpenAI = require('openai');

// Environment variables are already loaded by server.js in production

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Create embedding for text using OpenAI
 */
async function createEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-ada-002',
    input: text.substring(0, 8000), // OpenAI limit
  });
  return response.data[0].embedding;
}

/**
 * Index a transcript to Pinecone
 * Call this after saving a new transcript to the database
 */
async function indexTranscriptToPinecone(transcript, clientName = null) {
  try {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      console.log('[TranscriptIndexer] Pinecone not configured, skipping indexing');
      return { success: false, reason: 'not_configured' };
    }

    // Parse JSON fields if they're strings
    const topics = Array.isArray(transcript.topics) 
      ? transcript.topics 
      : (typeof transcript.topics === 'string' ? JSON.parse(transcript.topics) : []);
    
    const actionItems = Array.isArray(transcript.action_items)
      ? transcript.action_items
      : (typeof transcript.action_items === 'string' ? JSON.parse(transcript.action_items) : []);
    
    // Create searchable content combining all important fields
    const searchableContent = [
      transcript.title || '',
      transcript.summary || '',
      transcript.transcript_text || '',
      ...topics.map(t => typeof t === 'string' ? t : t.text || t.name || t.title || ''),
      ...actionItems.map(a => typeof a === 'string' ? a : a.text || a.description || ''),
    ].filter(Boolean).join('\n\n');

    if (!searchableContent.trim()) {
      console.log('[TranscriptIndexer] No content to index');
      return { success: false, reason: 'no_content' };
    }

    // Create embedding
    const embedding = await createEmbedding(searchableContent);

    // Prepare metadata (parse JSON if needed)
    const participants = Array.isArray(transcript.participants) 
      ? transcript.participants 
      : (typeof transcript.participants === 'string' ? JSON.parse(transcript.participants) : []);

    const metadata = {
      source_type: 'transcript',
      source_id: transcript.id,
      title: transcript.title || 'Untitled Meeting',
      summary: (transcript.summary || '').substring(0, 1000),
      client_id: transcript.client_id || null,
      client_name: clientName || null,
      scheduled_at: transcript.scheduled_at ? new Date(transcript.scheduled_at).toISOString() : null,
      duration_seconds: transcript.duration_seconds || 0,
      participants_count: participants.length,
      topics_count: topics.length,
      action_items_count: actionItems.length,
      assignment_status: transcript.assignment_status || 'unassigned',
      content: searchableContent.substring(0, 35000), // Pinecone metadata limit
      created_at: transcript.created_at ? new Date(transcript.created_at).toISOString() : new Date().toISOString(),
      indexed_at: new Date().toISOString(),
    };

    // Remove null/undefined values
    Object.keys(metadata).forEach(key => {
      if (metadata[key] === null || metadata[key] === undefined) {
        delete metadata[key];
      }
    });

    // Connect to Pinecone and upsert
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    await index.upsert([{
      id: `transcript_${transcript.id}`,
      values: embedding,
      metadata,
    }]);

    console.log(`[TranscriptIndexer] ✅ Indexed transcript ${transcript.id}: "${transcript.title}"`);
    return { success: true, id: `transcript_${transcript.id}` };

  } catch (error) {
    console.error(`[TranscriptIndexer] ❌ Error indexing transcript:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Delete a transcript from Pinecone
 */
async function deleteTranscriptFromPinecone(transcriptId) {
  try {
    if (!process.env.PINECONE_API_KEY || !process.env.PINECONE_INDEX_NAME) {
      return { success: false, reason: 'not_configured' };
    }

    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME);

    await index.deleteOne(`transcript_${transcriptId}`);

    console.log(`[TranscriptIndexer] ✅ Deleted transcript ${transcriptId} from Pinecone`);
    return { success: true };

  } catch (error) {
    console.error(`[TranscriptIndexer] ❌ Error deleting transcript:`, error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  indexTranscriptToPinecone,
  deleteTranscriptFromPinecone,
};

