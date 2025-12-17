-- Add session_id and full_conversation to agent_feedback table
ALTER TABLE agent_feedback 
ADD COLUMN IF NOT EXISTS session_id INTEGER,
ADD COLUMN IF NOT EXISTS full_conversation JSONB;

-- Add foreign key constraint
ALTER TABLE agent_feedback 
ADD CONSTRAINT fk_feedback_session 
FOREIGN KEY (session_id) REFERENCES agent_chat_sessions(id) ON DELETE CASCADE;

-- Add index for session_id
CREATE INDEX IF NOT EXISTS idx_agent_feedback_session_id ON agent_feedback(session_id);

-- Make rating nullable (for general feedback without rating)
ALTER TABLE agent_feedback ALTER COLUMN rating DROP NOT NULL;
