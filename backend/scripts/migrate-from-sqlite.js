/**
 * Migrate Transcripts from SQLite to PostgreSQL and Vectorize to Pinecone
 * 
 * This script:
 * 1. Reads transcripts from local SQLite database
 * 2. Transforms data for PostgreSQL schema
 * 3. Inserts into PostgreSQL on Render
 * 4. Vectorizes each transcript to Pinecone
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { indexTranscriptToPinecone } = require('../services/transcriptIndexer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

const SQLITE_DB_PATH = path.join(__dirname, '../../prisma/dev.db');
const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second

async function getSQLiteTranscripts() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY, (err) => {
      if (err) {
        reject(err);
        return;
      }
    });

    db.all(`SELECT * FROM meetings ORDER BY createdAt DESC`, [], (err, rows) => {
      if (err) {
        reject(err);
        return;
      }
      db.close();
      resolve(rows);
    });
  });
}

function parseJSONField(field) {
  if (!field) return null;
  if (typeof field === 'string') {
    try {
      return JSON.parse(field);
    } catch (e) {
      return null;
    }
  }
  return field;
}

async function migrateTranscript(meeting) {
  try {
    // Check if already migrated
    const existing = await pool.query(
      'SELECT id FROM meeting_transcripts WHERE meeting_id = $1',
      [meeting.id]
    );
    
    if (existing.rowCount > 0) {
      console.log(`   ⏭️  Skipping ${meeting.id} (already migrated)`);
      return { skipped: true };
    }
    
    // Parse transcript and summary
    const transcript = parseJSONField(meeting.transcript);
    const summary = parseJSONField(meeting.summary);
    
    // Extract transcript text
    let transcriptText = '';
    if (transcript && Array.isArray(transcript)) {
      transcriptText = transcript
        .map(segment => segment.text || '')
        .join(' ');
    }
    
    // Extract summary text
    let summaryText = '';
    let actionItems = [];
    let topics = [];
    let keyQuestions = [];
    
    if (summary) {
      summaryText = summary.summary || summary.text || '';
      actionItems = summary.action_items || summary.actionItems || [];
      topics = summary.topics || [];
      keyQuestions = summary.key_questions || summary.keyQuestions || [];
    }
    
    // Extract participants (if available)
    const participants = [];
    
    // Convert dates from SQLite format (could be timestamp or ISO string)
    let scheduledAt = null;
    const dateValue = meeting.scheduledStart || meeting.createdAt;
    if (dateValue) {
      // If it's a number (Unix timestamp in milliseconds), convert to Date
      if (typeof dateValue === 'number' || !isNaN(dateValue)) {
        scheduledAt = new Date(parseInt(dateValue));
      } else {
        // Otherwise try to parse as ISO string
        scheduledAt = new Date(dateValue);
      }
      // Validate the date
      if (isNaN(scheduledAt.getTime())) {
        scheduledAt = null;
      }
    }
    
    // Insert into PostgreSQL
    const result = await pool.query(
      `INSERT INTO meeting_transcripts (
        user_id, meeting_id, title, scheduled_at, duration_seconds,
        recording_url, transcript_url, transcript_text, summary,
        participants, topics, action_items, key_questions
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING *`,
      [
        1, // Default user ID
        meeting.id,
        meeting.title || meeting.meetingTitle,
        scheduledAt,
        null, // duration not in SQLite schema
        meeting.url,
        null,
        transcriptText,
        summaryText,
        JSON.stringify(participants),
        JSON.stringify(topics),
        JSON.stringify(actionItems),
        JSON.stringify(keyQuestions)
      ]
    );
    
    const transcript_record = result.rows[0];
    console.log(`   ✅ Migrated to PostgreSQL: ${transcript_record.id}`);
    
    // Vectorize to Pinecone
    console.log(`   🔍 Vectorizing to Pinecone...`);
    const vectorResult = await indexTranscriptToPinecone(transcript_record);
    
    if (vectorResult.success) {
      console.log(`   ✅ Vectorized: ${vectorResult.id}`);
    } else {
      console.log(`   ⚠️  Vectorization skipped: ${vectorResult.reason || vectorResult.error}`);
    }
    
    return { success: true, transcript: transcript_record };
    
  } catch (error) {
    console.error(`   ❌ Error migrating ${meeting.id}:`, error.message);
    return { error: error.message };
  }
}

async function main() {
  console.log('🚀 Starting transcript migration from SQLite to PostgreSQL...\n');
  
  // Check environment variables
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not set');
    process.exit(1);
  }
  
  if (!process.env.PINECONE_API_KEY) {
    console.error('⚠️  PINECONE_API_KEY not set - transcripts will be migrated but not vectorized');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('⚠️  OPENAI_API_KEY not set - vectorization will fail');
  }
  
  // Read from SQLite
  console.log('📄 Reading from SQLite database...');
  const meetings = await getSQLiteTranscripts();
  console.log(`✅ Found ${meetings.length} meetings in SQLite\n`);
  
  // Process in batches
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  for (let i = 0; i < meetings.length; i += BATCH_SIZE) {
    const batch = meetings.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Processing batch ${Math.floor(i / BATCH_SIZE) + 1} (records ${i + 1}-${Math.min(i + BATCH_SIZE, meetings.length)})...`);
    
    const promises = batch.map(meeting => migrateTranscript(meeting));
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      if (result.success) migrated++;
      else if (result.skipped) skipped++;
      else errors++;
    });
    
    console.log(`   Progress: ${migrated} migrated, ${skipped} skipped, ${errors} errors`);
    
    // Delay between batches
    if (i + BATCH_SIZE < meetings.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log('\n✅ Migration complete!');
  console.log(`   Total: ${meetings.length}`);
  console.log(`   Migrated: ${migrated}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

