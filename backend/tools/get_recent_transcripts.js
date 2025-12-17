// ============================================================================
// Tool: Get Recent Meeting Transcripts
// Gets most recent meeting transcripts for a client or all clients
// ============================================================================

module.exports = {
  name: 'get_recent_transcripts',
  description: `Get the most recent meeting transcripts to understand current campaign status, recent discussions, or follow-up on meetings.
  
  Use this tool when users ask about:
  - Recent meetings or calls
  - Latest discussions with a client
  - Campaign status updates from recent calls
  - What happened in recent meetings
  - Follow-up on recent conversations
  
  Examples:
  - "What were my recent meetings about?"
  - "Show me the latest calls with Acme Corp"
  - "Where are we in the GoldCoast campaign based on recent calls?"
  - "What was discussed in my last meeting?"`,
  
  parameters: {
    type: 'object',
    properties: {
      client_id: {
        type: 'integer',
        description: 'Optional: Filter by specific client ID. If not provided, shows recent transcripts from all clients.',
      },
      limit: {
        type: 'integer',
        description: 'Number of recent transcripts to return (default: 5, max: 20)',
        default: 5,
      },
      days_ago: {
        type: 'integer',
        description: 'Only show transcripts from the last N days (default: 30)',
        default: 30,
      },
    },
    required: [],
  },
  
  async execute({ client_id, limit = 5, days_ago = 30 }, { dbPool, clientId, userId }) {
    try {
      console.log(`[Tool:get_recent_transcripts] Getting recent transcripts (client: ${client_id || clientId || 'all'})`);
      
      // Limit to reasonable max
      const safeLimit = Math.min(limit, 20);
      
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
          mt.assignment_status,
          c.name as client_name,
          c.id as client_id
        FROM meeting_transcripts mt
        LEFT JOIN users c ON mt.client_id = c.id
        WHERE mt.scheduled_at >= NOW() - INTERVAL '${days_ago} days'
      `;
      
      const params = [];
      let paramIndex = 1;
      
      // Filter by client if explicitly provided (optional parameter only)
      if (client_id) {
        sqlQuery += ` AND mt.client_id = $${paramIndex}`;
        params.push(client_id);
        paramIndex++;
      }
      // NOTE: Removed automatic clientId filtering - all users see all transcripts
      
      sqlQuery += ` ORDER BY mt.scheduled_at DESC NULLS LAST, mt.created_at DESC LIMIT $${paramIndex}`;
      params.push(safeLimit);
      
      const result = await dbPool.query(sqlQuery, params);
      
      if (result.rowCount === 0) {
        return {
          success: true,
          message: `No meetings found in the last ${days_ago} days`,
          transcripts: [],
          count: 0,
        };
      }
      
      // Format results for AI
      const transcripts = result.rows.map(t => {
        const participants = t.participants ? JSON.parse(t.participants) : [];
        const actionItems = t.action_items ? JSON.parse(t.action_items) : [];
        const keyQuestions = t.key_questions ? JSON.parse(t.key_questions) : [];
        const topics = t.topics ? JSON.parse(t.topics) : [];
        
        const date = new Date(t.scheduled_at);
        const daysAgo = Math.floor((new Date() - date) / (1000 * 60 * 60 * 24));
        const timeAgo = daysAgo === 0 ? 'Today' : 
                        daysAgo === 1 ? 'Yesterday' : 
                        `${daysAgo} days ago`;
        
        return {
          id: t.id,
          title: t.title,
          client: t.client_name,
          client_id: t.client_id,
          date: t.scheduled_at,
          time_ago: timeAgo,
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
        };
      });
      
      // Generate summary message
      let message = `Found ${transcripts.length} recent meeting${transcripts.length !== 1 ? 's' : ''}`;
      if (client_id || clientId) {
        const clientName = transcripts[0]?.client || 'this client';
        message += ` with ${clientName}`;
      }
      message += ` in the last ${days_ago} days`;
      
      return {
        success: true,
        count: transcripts.length,
        transcripts,
        message,
        summary: generateCampaignSummary(transcripts),
      };
      
    } catch (error) {
      console.error('[Tool:get_recent_transcripts] Error:', error);
      return {
        success: false,
        error: error.message,
        message: 'Error retrieving recent transcripts',
      };
    }
  },
};

/**
 * Generate a quick campaign status summary from transcripts
 */
function generateCampaignSummary(transcripts) {
  if (transcripts.length === 0) return null;
  
  const totalMeetings = transcripts.length;
  const totalActionItems = transcripts.reduce((sum, t) => sum + (t.action_items?.length || 0), 0);
  const allTopics = transcripts.flatMap(t => t.topics || []);
  const uniqueTopics = [...new Set(allTopics)];
  
  const latestMeeting = transcripts[0];
  
  return {
    total_meetings: totalMeetings,
    total_action_items: totalActionItems,
    unique_topics_count: uniqueTopics.length,
    top_topics: uniqueTopics.slice(0, 5),
    latest_meeting: {
      title: latestMeeting.title,
      date: latestMeeting.time_ago,
      summary: latestMeeting.summary,
    },
  };
}

