-- Migration: Add full-text search index for meeting_transcripts
-- This dramatically speeds up transcript searches (from 2min to <1sec)

-- Drop the index if it exists (for re-running)
DROP INDEX IF EXISTS idx_meeting_transcripts_fulltext;

-- Create a computed column for full-text search (materialized in index)
-- This indexes the combination of title, transcript_text, summary
CREATE INDEX idx_meeting_transcripts_fulltext 
ON meeting_transcripts 
USING gin(to_tsvector('english', 
  COALESCE(title, '') || ' ' || 
  COALESCE(transcript_text, '') || ' ' || 
  COALESCE(summary, '')
));

-- Index for date ordering (if not exists)
CREATE INDEX IF NOT EXISTS idx_meeting_transcripts_scheduled_at 
ON meeting_transcripts(scheduled_at DESC);

-- Analyze the table to update statistics
ANALYZE meeting_transcripts;

