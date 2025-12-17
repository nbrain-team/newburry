/**
 * Feedback Routes - Store user feedback for agent training
 */

const express = require('express');
const router = express.Router();

module.exports = function(dbPool) {
  
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

  // Submit feedback for a message/conversation
  router.post('/submit', authenticate, async (req, res) => {
    const { 
      message_id, 
      session_id, 
      text_feedback, 
      full_conversation,
      rating 
    } = req.body;

    try {
      // Validate required fields
      if (!message_id || !session_id || !text_feedback) {
        return res.status(400).json({ 
          error: 'Missing required fields: message_id, session_id, text_feedback' 
        });
      }

      // Verify session ownership
      const sessionCheck = await dbPool.query(
        'SELECT id FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [session_id, req.userId]
      );

      if (sessionCheck.rowCount === 0) {
        return res.status(403).json({ error: 'Session not found or access denied' });
      }

      // Insert feedback
      const result = await dbPool.query(
        `INSERT INTO agent_feedback 
         (message_id, session_id, user_id, text_feedback, full_conversation, rating, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'pending')
         RETURNING *`,
        [
          message_id,
          session_id,
          req.userId,
          text_feedback,
          JSON.stringify(full_conversation || []),
          rating || null
        ]
      );

      console.log(`[Feedback] New feedback submitted by user ${req.userId} for session ${session_id}`);

      res.json({
        success: true,
        feedback: result.rows[0],
        message: 'Thank you for your feedback! This will help improve the AI agent.'
      });

    } catch (error) {
      console.error('[Feedback] Error submitting feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get all feedback (admin only)
  router.get('/all', authenticate, async (req, res) => {
    const { status, limit = 50, offset = 0 } = req.query;

    try {
      // Check if user is admin
      const userCheck = await dbPool.query(
        'SELECT role FROM users WHERE id = $1',
        [req.userId]
      );

      if (userCheck.rowCount === 0 || userCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      let whereClause = status ? 'WHERE status = $1' : '';
      let values = status ? [status, limit, offset] : [limit, offset];
      let paramOffset = status ? 2 : 1;

      const result = await dbPool.query(
        `SELECT 
          f.*,
          u.name as user_name,
          u.email as user_email,
          s.title as session_title,
          m.content as message_content
         FROM agent_feedback f
         JOIN users u ON f.user_id = u.id
         JOIN agent_chat_sessions s ON f.session_id = s.id
         JOIN agent_chat_messages m ON f.message_id = m.id
         ${whereClause}
         ORDER BY f.created_at DESC
         LIMIT $${paramOffset} OFFSET $${paramOffset + 1}`,
        values
      );

      res.json({
        success: true,
        feedback: result.rows,
        count: result.rowCount
      });

    } catch (error) {
      console.error('[Feedback] Error fetching feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Export feedback for training (admin only)
  router.get('/export', authenticate, async (req, res) => {
    const { status = 'pending', format = 'json' } = req.query;

    try {
      // Check if user is admin
      const userCheck = await dbPool.query(
        'SELECT role FROM users WHERE id = $1',
        [req.userId]
      );

      if (userCheck.rowCount === 0 || userCheck.rows[0].role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await dbPool.query(
        `SELECT 
          f.id,
          f.text_feedback,
          f.full_conversation,
          f.rating,
          f.created_at,
          u.name as user_name,
          s.title as session_title,
          m.content as message_content
         FROM agent_feedback f
         JOIN users u ON f.user_id = u.id
         JOIN agent_chat_sessions s ON f.session_id = s.id
         JOIN agent_chat_messages m ON f.message_id = m.id
         WHERE f.status = $1
         ORDER BY f.created_at DESC`,
        [status]
      );

      if (format === 'jsonl') {
        // JSONL format for training
        const jsonl = result.rows.map(row => JSON.stringify({
          conversation: row.full_conversation,
          feedback: row.text_feedback,
          rating: row.rating,
          metadata: {
            user: row.user_name,
            session: row.session_title,
            timestamp: row.created_at
          }
        })).join('\n');

        res.setHeader('Content-Type', 'application/x-ndjson');
        res.setHeader('Content-Disposition', `attachment; filename="feedback-training-${Date.now()}.jsonl"`);
        res.send(jsonl);
      } else {
        // JSON format
        res.json({
          success: true,
          feedback: result.rows,
          count: result.rowCount
        });
      }

    } catch (error) {
      console.error('[Feedback] Error exporting feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  return router;
};

