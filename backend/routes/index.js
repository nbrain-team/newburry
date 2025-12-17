/**
 * Agentic AI Brain - API Routes
 * 
 * All routes for the agent system.
 * Mount these in your main server: app.use('/api/agent-chat', agenticRoutes)
 */

const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Generate a concise chat title from conversation history using Gemini
 */
async function generateChatTitle(messages) {
  try {
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    // Build conversation summary
    const conversationText = messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.substring(0, 500)}`)
      .join('\n\n');

    const prompt = `Based on this conversation, generate a concise, descriptive title (max 60 characters). Return ONLY the title text, nothing else.

Conversation:
${conversationText}

Title:`;

    const result = await model.generateContent(prompt);
    const title = result.response.text().trim();
    
    // Clean up the title
    let cleanTitle = title
      .replace(/^["']|["']$/g, '') // Remove quotes
      .replace(/^Title:\s*/i, '') // Remove "Title:" prefix
      .trim();
    
    // Ensure it's not too long
    if (cleanTitle.length > 60) {
      cleanTitle = cleanTitle.substring(0, 57) + '...';
    }

    return cleanTitle || 'Chat';
  } catch (error) {
    console.error('[generateChatTitle] Error:', error);
    return null;
  }
}

module.exports = function(dbPool, orchestrator, toolRegistry, analysisQueue = null) {
  
  // ============================================================================
  // MIDDLEWARE
  // ============================================================================
  
  // JWT authentication middleware (adapt to your existing auth)
  const authenticate = async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      // Decode JWT (adapt to your existing auth logic)
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
        [req.userId, client_id || null, project_id || null, title, folder || null, tags || []]
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
      // Get session
      const sessionResult = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );

      if (sessionResult.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get messages
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

      updates.push('updated_at = NOW()');

      const result = await dbPool.query(
        `UPDATE agent_chat_sessions SET ${updates.join(', ')}
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        values
      );

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
      await dbPool.query(
        'DELETE FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [id, req.userId]
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Routes] Error deleting session:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // FILE ATTACHMENTS
  // ============================================================================

  // Upload file to chat session
  const multer = require('multer');
  const path = require('path');
  const fs = require('fs');
  const fileProcessor = require('../services/fileProcessor');

  // Configure multer for file uploads
  const uploadDir = path.join(__dirname, '..', 'uploads', 'agent-chat');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname);
      cb(null, `session-${req.params.id || 'new'}-${uniqueSuffix}${ext}`);
    },
  });

  const upload = multer({
    storage,
    limits: {
      fileSize: 100 * 1024 * 1024, // 100MB limit
    },
    fileFilter: (req, file, cb) => {
      // Allow most common file types
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'text/csv',
        'application/json',
        'audio/mpeg',
        'audio/wav',
        'audio/x-m4a',
        'audio/ogg',
        'video/mp4',
        'video/quicktime',
        'video/x-msvideo',
      ];

      if (
        allowedTypes.includes(file.mimetype) ||
        file.mimetype.startsWith('image/') ||
        file.mimetype.startsWith('text/')
      ) {
        cb(null, true);
      } else {
        cb(new Error('Unsupported file type'));
      }
    },
  });

  router.post('/sessions/:id/upload', authenticate, upload.single('file'), async (req, res) => {
    const { id: sessionId } = req.params;

    try {
      // Verify session ownership
      const sessionCheck = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.userId]
      );

      if (sessionCheck.rowCount === 0) {
        // Clean up uploaded file
        if (req.file) {
          try {
            fs.unlinkSync(req.file.path);
          } catch (e) {}
        }
        return res.status(404).json({ error: 'Session not found' });
      }

      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      // Save attachment metadata to database
      const attachmentResult = await dbPool.query(
        `INSERT INTO agent_chat_attachments 
         (session_id, user_id, file_name, original_name, file_type, file_size, file_path, processing_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'processing')
         RETURNING *`,
        [
          sessionId,
          req.userId,
          req.file.filename,
          req.file.originalname,
          req.file.mimetype,
          req.file.size,
          req.file.path,
        ]
      );

      const attachment = attachmentResult.rows[0];

      // Process file asynchronously
      setImmediate(async () => {
        try {
          const processingResult = await fileProcessor.processFile(
            req.file.path,
            req.file.mimetype,
            req.file.originalname
          );

          // Update attachment with processed content
          await dbPool.query(
            `UPDATE agent_chat_attachments 
             SET extracted_content = $1, metadata = $2, processing_status = $3, 
                 error_message = $4, processed_at = NOW()
             WHERE id = $5`,
            [
              processingResult.extracted_content,
              JSON.stringify(processingResult.metadata),
              processingResult.processing_status,
              processingResult.error_message,
              attachment.id,
            ]
          );

          console.log(`[AgentChat] File processed successfully: ${req.file.originalname}`);
        } catch (error) {
          console.error('[AgentChat] Error processing file:', error);
          await dbPool.query(
            `UPDATE agent_chat_attachments 
             SET processing_status = 'failed', error_message = $1, processed_at = NOW()
             WHERE id = $2`,
            [error.message, attachment.id]
          );
        }
      });

      // Return immediate response
      res.json({
        success: true,
        attachment: {
          id: attachment.id,
          file_name: attachment.file_name,
          original_name: attachment.original_name,
          file_type: attachment.file_type,
          file_size: attachment.file_size,
          processing_status: attachment.processing_status,
          created_at: attachment.created_at,
        },
      });
    } catch (error) {
      // Clean up file on error
      if (req.file) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (e) {}
      }
      console.error('[AgentChat] Error uploading file:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get attachments for a session
  router.get('/sessions/:id/attachments', authenticate, async (req, res) => {
    const { id: sessionId } = req.params;

    try {
      // Verify session ownership
      const sessionCheck = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.userId]
      );

      if (sessionCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get attachments
      const result = await dbPool.query(
        `SELECT id, original_name, file_type, file_size, processing_status, 
                metadata, created_at, processed_at
         FROM agent_chat_attachments 
         WHERE session_id = $1 
         ORDER BY created_at DESC`,
        [sessionId]
      );

      res.json({
        success: true,
        attachments: result.rows,
      });
    } catch (error) {
      console.error('[AgentChat] Error fetching attachments:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Delete attachment
  router.delete('/attachments/:id', authenticate, async (req, res) => {
    const { id: attachmentId } = req.params;

    try {
      // Get attachment and verify ownership
      const attachmentCheck = await dbPool.query(
        `SELECT a.*, s.user_id 
         FROM agent_chat_attachments a
         JOIN agent_chat_sessions s ON a.session_id = s.id
         WHERE a.id = $1`,
        [attachmentId]
      );

      if (attachmentCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Attachment not found' });
      }

      const attachment = attachmentCheck.rows[0];
      if (attachment.user_id !== req.userId) {
        return res.status(403).json({ error: 'Access denied' });
      }

      // Delete file from disk
      try {
        fs.unlinkSync(attachment.file_path);
      } catch (e) {
        console.warn('[AgentChat] Could not delete file from disk:', e.message);
      }

      // Delete from database
      await dbPool.query('DELETE FROM agent_chat_attachments WHERE id = $1', [attachmentId]);

      res.json({ success: true });
    } catch (error) {
      console.error('[AgentChat] Error deleting attachment:', error);
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

      // Get all completed attachments for this session
      const attachmentsResult = await dbPool.query(
        `SELECT id, original_name, file_type, extracted_content, metadata
         FROM agent_chat_attachments 
         WHERE session_id = $1 AND processing_status = 'completed' AND extracted_content IS NOT NULL
         ORDER BY created_at ASC`,
        [sessionId]
      );

      // Build attachment context
      let attachmentContext = '';
      if (attachmentsResult.rowCount > 0) {
        attachmentContext = '\n\n=== UPLOADED FILES CONTEXT ===\n';
        attachmentsResult.rows.forEach((att) => {
          attachmentContext += `\n[File: ${att.original_name}]\n`;
          attachmentContext += `${att.extracted_content}\n`;
          attachmentContext += `---\n`;
        });
        attachmentContext += '=== END UPLOADED FILES ===\n\n';
      }

      // Prepend attachment context to user message
      const enhancedMessage = attachmentContext 
        ? `${attachmentContext}User Query: ${message}` 
        : message;

      // Set up streaming response
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const streamCallback = async (event) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      // Process query through orchestrator with enhanced message
      // NOTE: clientId set to null - all users/advisors see all data
      const result = await orchestrator.processQuery({
        userMessage: enhancedMessage,
        conversationHistory: conversation_history,
        sessionId: parseInt(sessionId),
        userId: req.userId,
        clientId: null, // Don't restrict by client - advisors see all clients' data
        projectId: session.project_id,
        streamCallback,
        attachments: attachmentsResult.rows, // Pass attachments metadata
      });

      // Send final result
      res.write(`data: ${JSON.stringify({ type: 'complete', data: result })}\n\n`);
      res.end();

      // Auto-generate session title after first exchange (if still "New Chat")
      setImmediate(async () => {
        try {
          const session = sessionCheck.rows[0];
          if (!session.title || session.title === 'New Chat') {
            // Get first few messages to generate title
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
          // Non-fatal - don't block the response
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

  // Get pending feedback (admin only)
  router.get('/admin/feedback/pending', authenticate, async (req, res) => {
    // TODO: Add admin check
    
    try {
      const result = await dbPool.query(
        `SELECT f.*, m.content as message_content, u.name as user_name
         FROM agent_feedback f
         JOIN agent_chat_messages m ON f.message_id = m.id
         JOIN users u ON f.user_id = u.id
         WHERE f.status = 'pending'
         ORDER BY f.created_at DESC`
      );

      res.json({
        success: true,
        feedback: result.rows,
      });
    } catch (error) {
      console.error('[Routes] Error fetching pending feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Approve feedback (admin only)
  router.post('/admin/feedback/:id/approve', authenticate, async (req, res) => {
    // TODO: Add admin check
    const { id } = req.params;

    try {
      const result = await dbPool.query(
        `UPDATE agent_feedback 
         SET status = 'approved', approved_by = $1, approved_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [req.userId, id]
      );

      // TODO: Apply feedback to system (update prompts, preferences, etc.)

      res.json({
        success: true,
        feedback: result.rows[0],
      });
    } catch (error) {
      console.error('[Routes] Error approving feedback:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // SEARCH
  // ============================================================================

  // Search across all chats
  router.post('/search', authenticate, async (req, res) => {
    const { query, search_type = 'both', limit = 20 } = req.body;

    try {
      let results = [];

      // Keyword search
      if (search_type === 'keyword' || search_type === 'both') {
        const keywordResults = await dbPool.query(
          `SELECT m.*, s.title as session_title
           FROM agent_chat_messages m
           JOIN agent_chat_sessions s ON m.session_id = s.id
           WHERE s.user_id = $1 AND m.content ILIKE $2
           ORDER BY m.created_at DESC
           LIMIT $3`,
          [req.userId, `%${query}%`, limit]
        );

        results = [...results, ...keywordResults.rows.map(r => ({ ...r, search_type: 'keyword' }))];
      }

      // Semantic search (via Pinecone)
      // TODO: Implement semantic search

      res.json({
        success: true,
        results,
        count: results.length,
      });
    } catch (error) {
      console.error('[Routes] Error searching:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // TOOLS (for testing/debugging)
  // ============================================================================

  // List available tools
  router.get('/tools', authenticate, async (req, res) => {
    try {
      const tools = toolRegistry.getToolDescriptions();
      
      res.json({
        success: true,
        tools,
        count: tools.length,
      });
    } catch (error) {
      console.error('[Routes] Error listing tools:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // AUTO-TITLE GENERATION
  // ============================================================================

  // Manually trigger title generation for a session (optional endpoint)
  router.post('/sessions/:id/generate-title', authenticate, async (req, res) => {
    const { id: sessionId } = req.params;

    try {
      // Verify session ownership
      const sessionCheck = await dbPool.query(
        'SELECT * FROM agent_chat_sessions WHERE id = $1 AND user_id = $2',
        [sessionId, req.userId]
      );

      if (sessionCheck.rowCount === 0) {
        return res.status(404).json({ error: 'Session not found' });
      }

      // Get messages
      const messagesResult = await dbPool.query(
        `SELECT content, role FROM agent_chat_messages 
         WHERE session_id = $1 
         ORDER BY created_at ASC 
         LIMIT 6`,
        [sessionId]
      );

      if (messagesResult.rowCount < 2) {
        return res.status(400).json({ error: 'Not enough messages to generate title' });
      }

      const generatedTitle = await generateChatTitle(messagesResult.rows);

      if (!generatedTitle) {
        return res.status(500).json({ error: 'Failed to generate title' });
      }

      // Update session
      const updateResult = await dbPool.query(
        'UPDATE agent_chat_sessions SET title = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
        [generatedTitle, sessionId]
      );

      res.json({
        success: true,
        title: generatedTitle,
        session: updateResult.rows[0],
      });
    } catch (error) {
      console.error('[Routes] Error generating title:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // ANALYSIS JOBS - Background job status tracking
  // ============================================================================
  
  /**
   * Get analysis job status
   * GET /analysis-jobs/:jobId
   */
  router.get('/analysis-jobs/:jobId', authenticate, async (req, res) => {
    try {
      const { jobId } = req.params;
      
      const result = await pool.query(
        `SELECT job_id, job_type, status, progress, current_pass, 
                results, error_message, estimated_duration_seconds,
                started_at, completed_at, created_at
         FROM analysis_jobs 
         WHERE job_id = $1 AND user_id = $2`,
        [jobId, req.user.id]
      );
      
      if (result.rowCount === 0) {
        return res.status(404).json({ 
          ok: false, 
          error: 'Job not found' 
        });
      }
      
      const job = result.rows[0];
      
      // Calculate elapsed time
      const startedAt = job.started_at ? new Date(job.started_at) : null;
      const completedAt = job.completed_at ? new Date(job.completed_at) : null;
      const now = new Date();
      
      let elapsedSeconds = 0;
      if (startedAt) {
        const endTime = completedAt || now;
        elapsedSeconds = Math.floor((endTime - startedAt) / 1000);
      }
      
      // Calculate remaining time
      let remainingSeconds = 0;
      if (job.status === 'processing' && startedAt) {
        remainingSeconds = Math.max(0, job.estimated_duration_seconds - elapsedSeconds);
      }
      
      res.json({
        ok: true,
        job: {
          job_id: job.job_id,
          job_type: job.job_type,
          status: job.status,
          progress: job.progress,
          current_pass: job.current_pass,
          results: job.results,
          error_message: job.error_message,
          estimated_duration_seconds: job.estimated_duration_seconds,
          elapsed_seconds: elapsedSeconds,
          remaining_seconds: remainingSeconds,
          started_at: job.started_at,
          completed_at: job.completed_at,
          created_at: job.created_at,
        }
      });
      
    } catch (error) {
      console.error('[Routes] Error fetching job status:', error);
      res.status(500).json({ 
        ok: false, 
        error: error.message 
      });
    }
  });
  
  /**
   * List user's analysis jobs
   * GET /analysis-jobs
   */
  router.get('/analysis-jobs', authenticate, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status; // Optional filter
      
      let query = `
        SELECT aj.job_id, aj.job_type, aj.status, aj.progress, aj.current_pass,
               aj.estimated_duration_seconds, aj.started_at, aj.completed_at, aj.created_at,
               mt.title as transcript_title
        FROM analysis_jobs aj
        LEFT JOIN meeting_transcripts mt ON aj.transcript_id = mt.id
        WHERE aj.user_id = $1
      `;
      
      const params = [req.user.id];
      
      if (status) {
        query += ` AND aj.status = $2`;
        params.push(status);
      }
      
      query += ` ORDER BY aj.created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);
      
      const result = await pool.query(query, params);
      
      res.json({
        ok: true,
        jobs: result.rows
      });
      
    } catch (error) {
      console.error('[Routes] Error listing jobs:', error);
      res.status(500).json({ 
        ok: false, 
        error: error.message 
      });
    }
  });

  return router;
};
