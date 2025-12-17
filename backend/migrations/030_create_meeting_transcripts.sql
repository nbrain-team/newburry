-- ============================================================================
-- Migration: Meeting Transcripts (Read.ai Integration)
-- Purpose: Store meeting transcripts from Read.ai webhook
-- ============================================================================

-- Main transcripts table
CREATE TABLE IF NOT EXISTS meeting_transcripts (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Read.ai data
  meeting_id VARCHAR(255) UNIQUE,
  title TEXT,
  scheduled_at TIMESTAMP,
  duration_seconds INTEGER,
  recording_url TEXT,
  transcript_url TEXT,
  
  -- Meeting content
  transcript_text TEXT,
  summary TEXT,
  chapters JSONB, -- Array of chapter objects
  topics JSONB, -- Array of topics
  action_items JSONB, -- Array of action items
  key_questions JSONB, -- Array of key questions
  participants JSONB, -- Array of {name, email, speaking_time}
  
  -- AI-generated insights
  ai_summary TEXT, -- Our own AI-generated summary
  ai_insights JSONB, -- Additional AI analysis
  
  -- Assignment tracking
  assignment_status VARCHAR(50) DEFAULT 'unassigned', -- unassigned, auto, manual
  assigned_at TIMESTAMP,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  
  -- Webhook metadata
  raw_payload JSONB, -- Full webhook payload for debugging
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transcripts_user ON meeting_transcripts(user_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_client ON meeting_transcripts(client_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_opportunity ON meeting_transcripts(opportunity_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_meeting_id ON meeting_transcripts(meeting_id);
CREATE INDEX IF NOT EXISTS idx_transcripts_scheduled ON meeting_transcripts(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_transcripts_assignment_status ON meeting_transcripts(assignment_status);
CREATE INDEX IF NOT EXISTS idx_transcripts_created ON meeting_transcripts(created_at DESC);

-- Full-text search on transcript content
CREATE INDEX IF NOT EXISTS idx_transcripts_search ON meeting_transcripts 
  USING gin(to_tsvector('english', 
    COALESCE(title, '') || ' ' || 
    COALESCE(transcript_text, '') || ' ' || 
    COALESCE(summary, '')
  ));

-- Participant email matching tracking
CREATE TABLE IF NOT EXISTS transcript_participant_matches (
  id SERIAL PRIMARY KEY,
  transcript_id INTEGER NOT NULL REFERENCES meeting_transcripts(id) ON DELETE CASCADE,
  participant_email VARCHAR(255),
  matched_client_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  match_confidence VARCHAR(50), -- exact, fuzzy, none
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_participant_matches_transcript ON transcript_participant_matches(transcript_id);
CREATE INDEX IF NOT EXISTS idx_participant_matches_client ON transcript_participant_matches(matched_client_id);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_transcript_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_meeting_transcripts_timestamp
  BEFORE UPDATE ON meeting_transcripts
  FOR EACH ROW
  EXECUTE FUNCTION update_transcript_timestamp();

COMMENT ON TABLE meeting_transcripts IS 'Stores meeting transcripts from Read.ai webhooks';
COMMENT ON COLUMN meeting_transcripts.assignment_status IS 'unassigned, auto (auto-assigned via email match), manual (manually assigned)';
COMMENT ON COLUMN meeting_transcripts.participants IS 'Array of {name, email, speaking_time_seconds}';

