// ============================================================================
// Tool: Search Meeting Transcripts
// Allows AI to search and retrieve meeting transcript data
// ============================================================================

module.exports = {
  name: 'search_transcripts',
  description: `🎯 PRIMARY & REQUIRED TOOL for ALL transcript/meeting/call queries. Searches meeting transcripts to find discussions, action items, decisions, and meeting summaries. 
  
  ALWAYS use this tool FIRST (before any CRM or database tools) when users ask about:
  - "analyze the transcript" or "analyze the meeting" or "analyze our call"
  - "most recent transcript" or "today's meeting" or "our call with [client]"
  - Any meeting, call, or conversation (e.g., "summarize our call with Seagate", "what did we discuss")
  - Action items from meetings or "what did I commit to"
  - Decisions made in calls or "what was discussed"
  - Meeting summaries or key points
  - Follow-up items from meetings
  - Specific topics discussed in meetings
  - Client conversations or discussions
  
  DO NOT use get_crm_data or database tools when the user explicitly asks about transcripts/meetings/calls.
  This tool searches by client name, participants, title, summary, and full transcript text.`,
  
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query to find relevant transcripts (searches title, summary, and transcript text)',
      },
      client_id: {
        type: 'integer',
        description: 'Optional: Filter by specific client ID',
      },
      limit: {
        type: 'integer',
        description: 'Maximum number of results to return (default: 5)',
        default: 5,
      },
      days_ago: {
        type: 'integer',
        description: 'Optional: Only show transcripts from the last N days',
      },
    },
    required: ['query'],
  },
  
  async execute({ query, client_id, limit = 5, days_ago }, { dbPool, clientId, userId }) {
    try {
      console.log(`[Tool:search_transcripts] Searching for: "${query}"`);
      console.log(`[Tool:search_transcripts] Context - clientId: ${clientId}, userId: ${userId}`);
      console.log(`[Tool:search_transcripts] Params - client_id: ${client_id}, limit: ${limit}, days_ago: ${days_ago}`);
      
      // Simplified query that uses the GIN index (much faster)
      let sqlQuery = `
        SELECT 
          mt.id,
          mt.title,
          mt.scheduled_at,
          mt.duration_seconds,
          mt.summary,
          mt.action_items,
          mt.key_questions,
          mt.topics,
          mt.participants,
          LEFT(mt.transcript_text, 2000) as transcript_text,
          mt.assignment_status,
          ts_rank(to_tsvector('english', 
            COALESCE(mt.title, '') || ' ' || 
            COALESCE(mt.transcript_text, '') || ' ' || 
            COALESCE(mt.summary, '')
          ), plainto_tsquery('english', $1)) as relevance
        FROM meeting_transcripts mt
        WHERE to_tsvector('english', 
            COALESCE(mt.title, '') || ' ' || 
            COALESCE(mt.transcript_text, '') || ' ' || 
            COALESCE(mt.summary, '')
          ) @@ plainto_tsquery('english', $1)
      `;
      
      const params = [query];
      let paramIndex = 2;
      
      // Filter by client if explicitly provided (optional parameter only)
      if (client_id) {
        sqlQuery += ` AND mt.client_id = $${paramIndex}`;
        params.push(client_id);
        paramIndex++;
      }
      
      // Filter by date range if provided
      if (days_ago) {
        sqlQuery += ` AND mt.scheduled_at >= NOW() - INTERVAL '${days_ago} days'`;
      }
      
      // Limit results for performance - use smaller limit
      const actualLimit = Math.min(limit, 10);
      sqlQuery += ` ORDER BY relevance DESC, mt.scheduled_at DESC LIMIT $${paramIndex}`;
      params.push(actualLimit);
      
      console.log(`[Tool:search_transcripts] Executing optimized SQL query with limit ${actualLimit}...`);
      
      const result = await dbPool.query(sqlQuery, params);
      
      console.log(`[Tool:search_transcripts] Query returned ${result.rowCount} rows`);
      
      if (result.rowCount === 0) {
        return {
          success: true,
          message: 'No matching transcripts found',
          transcripts: [],
        };
      }
      
      // Format results for AI
      const transcripts = result.rows.map(t => {
        // Robust JSON parsing - handle strings, arrays, or objects
        const parseField = (field) => {
          if (!field) return [];
          if (Array.isArray(field)) return field;
          if (typeof field === 'string') {
            try {
              return JSON.parse(field);
            } catch (e) {
              return [];
            }
          }
          if (typeof field === 'object') return [field];
          return [];
        };
        
        const participants = parseField(t.participants);
        const actionItems = parseField(t.action_items);
        const keyQuestions = parseField(t.key_questions);
        const topics = parseField(t.topics);
        
        return {
          id: t.id,
          title: t.title,
          date: t.scheduled_at,
          duration_minutes: t.duration_seconds ? Math.floor(t.duration_seconds / 60) : null,
          summary: t.summary,
          participants: participants.map(p => ({
            name: p.name,
            email: p.email,
          })),
          topics: topics.map(topic => 
            typeof topic === 'string' ? topic : topic.name || topic.title
          ),
          action_items: actionItems.map(item => 
            typeof item === 'string' ? item : item.text || item.description
          ),
          key_questions: keyQuestions.map(q => 
            typeof q === 'string' ? q : q.question || q.text
          ),
          transcript_excerpt: t.transcript_text 
            ? t.transcript_text.substring(0, 500) + (t.transcript_text.length > 500 ? '...' : '')
            : null,
          assignment_status: t.assignment_status,
        };
      });
      
      return {
        success: true,
        count: transcripts.length,
        transcripts,
        message: `Found ${transcripts.length} relevant meeting transcript${transcripts.length !== 1 ? 's' : ''}`,
        data: { transcripts, count: transcripts.length },
        confidence: transcripts.length > 0 ? 0.95 : 0.5,
        source_type: 'transcript_search',
        data_points: transcripts.map(t => ({
          title: t.title,
          date: t.date,
        })),
      };
      
    } catch (error) {
      console.error('[Tool:search_transcripts] Error:', error);
      console.error('[Tool:search_transcripts] Stack:', error.stack);
      return {
        success: false,
        error: error.message,
        message: 'Error searching transcripts',
        data: null,
        confidence: 0,
        source_type: 'transcript_search',
      };
    }
  },
};

