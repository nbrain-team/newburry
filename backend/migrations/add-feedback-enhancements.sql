-- Add session_id and full_conversation to agent_feedback table
ALTER TABLE agent_feedback 
ADD COLUMN IF NOT EXISTS session_id INTEGER,
ADD COLUMN IF NOT EXISTS full_conversation JSONB;

-- Add foreign key constraint (only if it doesn't exist)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_feedback_session'
  ) THEN
    ALTER TABLE agent_feedback 
    ADD CONSTRAINT fk_feedback_session 
    FOREIGN KEY (session_id) REFERENCES agent_chat_sessions(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for session_id
CREATE INDEX IF NOT EXISTS idx_agent_feedback_session_id ON agent_feedback(session_id);

-- Make rating nullable (for general feedback without rating)
DO $$ 
BEGIN
  ALTER TABLE agent_feedback ALTER COLUMN rating DROP NOT NULL;
EXCEPTION
  WHEN others THEN NULL; -- Ignore if already nullable
END $$;
