/**
 * Vectorize All Existing Transcripts to Pinecone
 * 
 * This script reads all transcripts from PostgreSQL and vectorizes them to Pinecone
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const { Pool } = require('pg');
const { indexTranscriptToPinecone } = require('../services/transcriptIndexer');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
});

const BATCH_SIZE = 10;
const DELAY_BETWEEN_BATCHES = 1000; // 1 second

async function main() {
  console.log('🚀 Starting vectorization of all transcripts to Pinecone...\n');
  
  // Check environment variables
  if (!process.env.PINECONE_API_KEY) {
    console.error('❌ PINECONE_API_KEY not set');
    process.exit(1);
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ OPENAI_API_KEY not set');
    process.exit(1);
  }
  
  // Get all transcripts from PostgreSQL
  console.log('📄 Fetching transcripts from PostgreSQL...');
  const result = await pool.query(
    `SELECT * FROM meeting_transcripts ORDER BY id ASC`
  );
  
  console.log(`✅ Found ${result.rowCount} transcripts in database\n`);
  
  const transcripts = result.rows;
  let vectorized = 0;
  let skipped = 0;
  let errors = 0;
  
  // Process in batches
  for (let i = 0; i < transcripts.length; i += BATCH_SIZE) {
    const batch = transcripts.slice(i, i + BATCH_SIZE);
    console.log(`\n📦 Vectorizing batch ${Math.floor(i / BATCH_SIZE) + 1} (records ${i + 1}-${Math.min(i + BATCH_SIZE, transcripts.length)})...`);
    
    const promises = batch.map(async (transcript) => {
      try {
        console.log(`   🔍 Vectorizing transcript ${transcript.id}: "${transcript.title?.substring(0, 50)}..."`);
        const result = await indexTranscriptToPinecone(transcript);
        
        if (result.success) {
          console.log(`   ✅ Vectorized: ${result.id}`);
          return { success: true };
        } else {
          console.log(`   ⚠️  Skipped: ${result.reason || result.error}`);
          return { skipped: true };
        }
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        return { error: true };
      }
    });
    
    const results = await Promise.all(promises);
    
    results.forEach(result => {
      if (result.success) vectorized++;
      else if (result.skipped) skipped++;
      else errors++;
    });
    
    console.log(`   Progress: ${vectorized} vectorized, ${skipped} skipped, ${errors} errors`);
    
    // Delay between batches
    if (i + BATCH_SIZE < transcripts.length) {
      console.log(`   ⏳ Waiting ${DELAY_BETWEEN_BATCHES}ms before next batch...`);
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  console.log('\n✅ Vectorization complete!');
  console.log(`   Total: ${transcripts.length}`);
  console.log(`   Vectorized: ${vectorized}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors: ${errors}`);
  
  await pool.end();
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

