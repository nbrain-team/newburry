/**
 * Newburry Platform - AI Agent Chat Routes (Simplified)
 * 
 * Core agent chat functionality without file upload dependencies
 */

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generate a concise chat title from conversation history
 */
async function generateChatTitle(messages) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `Based on this conversation, generate a concise, descriptive title (max 60 characters). Return ONLY the title text, nothing else.

Conversation:
${conversationText}

Title:`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim()
      .replace(/^["']|["']$/g, '')
      .replace(/^Title:\s*/i, '')
      .trim();
    
    return title.length > 60 ? title.substring(0, 57) + '...' : (title || 'Chat');
  } catch (error) {
    console.error('[generateChatTitle] Error:', error);
    return null;
  }
}

module.exports = function(dbPool, orchestrator, toolRegistry) {
  
  // ============================================================================
  // MIDDLEWARE
  // ============================================================================
  
  const authenticate = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.userId = decoded.userId || decoded.id;
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };

  // ============================================================================
  // CHAT SESSIONS
  // ============================================================================

  // Create new chat session
  router.post('/sessions', authenticate, async (req, res) => {
    const { title, client_id, project_id, folder, tags } = req.body;
    
    try {
      const result = await dbPool.query(
        `INSERT INTO agent_chat_sessions (user_id, client_id, project_id, title, folder, tags)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [req.userId, client_id || null, project_id || null, title || 'New Chat', folder || null, tags || []]
      );

      res.json({
        success: true,
        session: result.rows[0],
      });
    } catch (error) {
      console.error('[Routes] Error creating session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all sessions for user
  router.get('/sessions', authenticate, async (req, res) => {
    const { folder, client_id, search, limit = 50, offset = 0 } = req.query;
    
    try {
      let whereConditions = ['user_id = $1', 'is_archived = false'];
      let values = [req.userId];
      let paramCounter = 2;

      if (folder) {
        whereConditions.push(`folder = $${paramCounter}`);
        values.push(folder);
        paramCounter++;
      }

      if (client_id) {
        whereConditions.push(`client_id = $${paramCounter}`);
        values.push(client_id);
        paramCounter++;
      }

      if (search) {
        whereConditions.push(`title ILIKE $${paramCounter}`);
        values.push(`%${search}%`);
        paramCounter++;
      }

      const result = await dbPool.query(
        `SELECT * FROM agent_chat_sessions 
         WHERE ${whereConditions.join(' AND ')}
         ORDER BY updated_at DESC
         LIMIT $${paramCounter} OFFSET $${paramCounter + 1}`,
        [...values, limit, offset]
      );

      res.json({
        success: true,
        sessions: result.rows,
        count: result.rowCount,
      });
    } catch (error) {
      console.error('[Routes] Error fetching sessions:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get single session with messages
  router.get('/sessions/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    
    try {
      const sessionResult = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );

      if (sessionResult.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const messagesResult = await dbPool.query(
        'SELECT * FROM agent_chat_messages WHERE session_id = $1 ORDER BY created_at ASC',
        [id]
      );

      res.json({
        success: true,
        session: sessionResult.rows[0],
        messages: messagesResult.rows,
      });
    } catch (error) {
      console.error('[Routes] Error fetching session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Update session
  router.put('/sessions/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    const { title, folder, tags, is_archived } = req.body;
    
    try {
      const updates = [];
      const values = [id, req.userId];
      let paramCounter = 3;

      if (title !== undefined) {
        updates.push(`title = $${paramCounter}`);
        values.push(title);
        paramCounter++;
      }

      if (folder !== undefined) {
        updates.push(`folder = $${paramCounter}`);
        values.push(folder);
        paramCounter++;
      }

      if (tags !== undefined) {
        updates.push(`tags = $${paramCounter}`);
        values.push(tags);
        paramCounter++;
      }

      if (is_archived !== undefined) {
        updates.push(`is_archived = $${paramCounter}`);
        values.push(is_archived);
        paramCounter++;
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'No updates provided' });
      }

      const result = await dbPool.query(
        `UPDATE agent_chat_sessions 
         SET ${updates.join(', ')}, updated_at = NOW()
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        values
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        session: result.rows[0],
      });
    } catch (error) {
      console.error('[Routes] Error updating session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete session
  router.delete('/sessions/:id', authenticate, async (req, res) => {
    const { id } = req.params;
    
    try {
      const result = await dbPool.query(
        'DELETE FROM agent_chat_sessions WHERE id = $1 AND user_id = $2 RETURNING *',
        [id, req.userId]
      );

      if (result.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      res.json({
        success: true,
        message: 'Session deleted',
      });
    } catch (error) {
      console.error('[Routes] Error deleting session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // MESSAGES & CHAT
  // ============================================================================

  // Send message (with streaming)
  router.post('/sessions/:id/message', authenticate, async (req, res) => {
    const { id: sessionId } = req.params;
    const { message, conversation_history = [] } = req.body;

    try {
      // Verify session ownership
      const sessionCheck = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.userId]
      );

      if (sessionCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      const session = sessionCheck.rows[0];

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamCallback = async (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Process query through orchestrator
      const result = await orchestrator.processQuery({
        userMessage: message,
        conversationHistory: conversation_history,
        sessionId: parseInt(sessionId),
        userId: req.userId,
        clientId: null,
        projectId: session.project_id,
        streamCallback,
      });

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.end();

      // Auto-generate session title after first exchange
      setImmediate(async () => {
        try {
          if (!session.title || session.title === 'New Chat') {
            const messagesResult = await dbPool.query(
              `SELECT content, role FROM agent_chat_messages 
               WHERE session_id = $1 
               ORDER BY created_at ASC 
               LIMIT 4`,
              [sessionId]
            );

            if (messagesResult.rowCount >= 2) {
              const generatedTitle = await generateChatTitle(messagesResult.rows);
              
              if (generatedTitle) {
                await dbPool.query(
                  'UPDATE agent_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2',
                  [generatedTitle, sessionId]
                );
                console.log(`[AI Agent] Auto-generated title for session ${sessionId}: "${generatedTitle}"`);
              }
            }
          }
        } catch (error) {
          console.error('[AI Agent] Error auto-generating title:', error);
        }
      });

    } catch (error) {
      console.error('[Routes] Error processing message:', error);
      res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
      res.end();
    }
  });

  // ============================================================================
  // FEEDBACK
  // ============================================================================

  // Submit feedback for a message
  router.post('/messages/:id/feedback', authenticate, async (req, res) => {
    const { id: messageId } = req.params;
    const { rating, categories, text_feedback, training_instruction } = req.body;

    try {
      const result = await dbPool.query(
        `INSERT INTO agent_feedback (message_id, user_id, rating, categories, text_feedback, training_instruction)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [messageId, req.userId, rating, JSON.stringify(categories || {}), text_feedback, training_instruction]
      );

      res.json({
        success: true,
        feedback: result.rows[0],
      });
    } catch (error) {
      console.error('[Routes] Error submitting feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

