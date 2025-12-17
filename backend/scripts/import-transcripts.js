/**
 * Import Transcripts from Fathom CSV and Vectorize to Pinecone
 * 
 * This script:
 * 1. Reads transcripts_list.csv
 * 2. Fetches full transcript data from Fathom API
 * 3. Saves to PostgreSQL database
 * 4. Vectorizes and indexes to Pinecone
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { indexTranscriptToPinecone } = require('../services/transcriptIndexer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

const FATHOM_API_KEY = process.env.FATHOM_API_KEY;
const CSV_PATH = path.join(__dirname, '../../transcripts_list.csv');
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds

async function fetchTranscriptFromFathom(recordingId) {
  try {
    const response = await axios.get(
      `https://api.fathom.ai/external/v1/meetings/${recordingId}`,
      {
        headers: {
          'X-Api-Key': FATHOM_API_KEY,
        },
        params: {
          include_transcript: 'true',
          include_summary: 'true',
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error(`   ❌ Error fetching ${recordingId}:`, error.message);
    return null;
  }
}

function parseCSV(csvContent) {
  const lines = csvContent.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  
  const records = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const record = {};
    headers.forEach((header, index) => {
      record[header] = values[index];
    });
    records.push(record);
  }
  
  return records;
}

async function importTranscript(recordingId, title, dateCreated, url) {
  try {
    // Check if already imported
    const existing = await pool.query(
      'SELECT id FROM meeting_transcripts WHERE meeting_id = $1',
      [recordingId]
    );
    
    if (existing.rowCount > 0) {
      console.log(`   ⏭️  Skipping ${recordingId} (already imported)`);
      return { skipped: true };
    }
    
    // Fetch full transcript from Fathom
    console.log(`   📥 Fetching ${recordingId}...`);
    const fathomData = await fetchTranscriptFromFathom(recordingId);
    
    if (!fathomData) {
      return { error: 'Failed to fetch from Fathom' };
    }
    
    // Extract transcript text
    let transcriptText = '';
    if (fathomData.transcript && Array.isArray(fathomData.transcript)) {
      transcriptText = fathomData.transcript
        .map(segment => segment.text || '')
        .join(' ');
    }
    
    // Extract participants
    const participants = (fathomData.participants || []).map(p => ({
      name: p.name || 'Unknown',
      email: p.email || null,
      speaking_time_seconds: p.speaking_time_seconds || 0
    }));
    
    // Extract summary
    const summary = fathomData.default_summary?.summary || fathomData.summary || '';
    
    // Extract action items
    const actionItems = (fathomData.default_summary?.action_items || []).map(item => ({
      text: item.text || item,
      assigned_to: item.assigned_to || null
    }));
    
    // Extract topics
    const topics = (fathomData.default_summary?.topics || fathomData.topics || []).map(topic => ({
      name: typeof topic === 'string' ? topic : (topic.name || topic.title || 'Unknown')
    }));
    
    // Extract key questions
    const keyQuestions = (fathomData.default_summary?.key_questions || []).map(q => ({
      question: typeof q === 'string' ? q : (q.question || q.text || '')
    }));
    
    // Insert into database (user_id = 1 for admin/default)
    const result = await pool.query(
      `INSERT INTO meeting_transcripts (
        user_id, meeting_id, title, scheduled_at, duration_seconds,
        recording_url, transcript_url, transcript_text, summary,
        participants, topics, action_items, key_questions, raw_payload
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        1, // Default user ID
        recordingId,
        title || fathomData.meeting_title || fathomData.title,
        dateCreated ? new Date(dateCreated) : null,
        fathomData.duration_seconds || null,
        fathomData.recording_url || url,
        fathomData.transcript_url || null,
        transcriptText,
        summary,
        JSON.stringify(participants),
        JSON.stringify(topics),
        JSON.stringify(actionItems),
        JSON.stringify(keyQuestions),
        JSON.stringify(fathomData)
      ]
    );
    
    const transcript = result.rows[0];
    console.log(`   ✅ Saved to database: ${transcript.id}`);
    
    // Vectorize to Pinecone
    console.log(`   🔍 Vectorizing to Pinecone...`);
    const vectorResult = await indexTranscriptToPinecone(transcript);
    
    if (vectorResult.success) {
      console.log(`   ✅ Vectorized: ${vectorResult.id}`);
    } else {
      console.log(`   ⚠️  Vectorization skipped: ${vectorResult.reason || vectorResult.error}`);
    }
    
    return { success: true, transcript };
    
  } catch (error) {
    console.error(`   ❌ Error importing ${recordingId}:`, error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting transcript import and vectorization...\n');
  
  // Check environment variables
  if (!FATHOM_API_KEY) {
    console.error('❌ FATHOM_API_KEY not set');
    process.exit(1);
  }
  
  if (!process.env.PINECONE_API_KEY) {
    console.error('⚠️  PINECONE_API_KEY not set - transcripts will be imported but not vectorized');
  }
  
  // Read CSV
  console.log('📄 Reading transcripts_list.csv...');
  const csvContent = fs.readFileSync(CSV_PATH, 'utf8');
  const records = parseCSV(csvContent);
  console.log(`✅ Found ${records.length} transcripts in CSV\n`);
  
  // Process in batches
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (records ${i + 1}-${Math.min(i + BATCH_SIZE, records.length)})...`);
    
    const promises = batch.map(record => 
      importTranscript(
        record['Recording ID'],
        record['Title'],
        record['Date Created'],
        record['URL']
      )
    );
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      if (result.success) imported++;
      else if (result.skipped) skipped++;
      else errors++;
    });
    
    console.log(`   Progress: ${imported} imported, ${skipped} skipped, ${errors} errors`);
    
    // Delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < records.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log('\n✅ Import complete!');
  console.log(`   Total: ${records.length}`);
  console.log(`   Imported: ${imported}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


