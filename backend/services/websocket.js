/**
 * Agentic AI Brain - WebSocket Service
 * 
 * Handles real-time collaboration features:
 * - Presence tracking
 * - Typing indicators
 * - Live updates
 * - Multi-user sessions
 */

module.exports = {
  io: null,
  dbPool: null,

  initialize(socketIO, pool) {
    this.io = socketIO;
    this.dbPool = pool;

    socketIO.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);

      // Join session
      socket.on('join_session', async ({ sessionId, userId }) => {
        try {
          socket.join(`session-${sessionId}`);
          
          // Update presence
          await this.updatePresence(sessionId, userId, true, socket.id);
          
          // Notify others
          socket.to(`session-${sessionId}`).emit('user_joined', {
            userId,
            socketId: socket.id,
          });

          // Send current participants to new user
          const participants = await this.getSessionParticipants(sessionId);
          socket.emit('session_participants', participants);

        } catch (error) {
          console.error('[WebSocket] Error joining session:', error);
        }
      });

      // Leave session
      socket.on('leave_session', async ({ sessionId, userId }) => {
        try {
          socket.leave(`session-${sessionId}`);
          
          await this.updatePresence(sessionId, userId, false, null);
          
          socket.to(`session-${sessionId}`).emit('user_left', { userId });
        } catch (error) {
          console.error('[WebSocket] Error leaving session:', error);
        }
      });

      // Typing indicators
      socket.on('typing_start', ({ sessionId, userId }) => {
        socket.to(`session-${sessionId}`).emit('user_typing', {
          userId,
          isTyping: true,
        });
      });

      socket.on('typing_stop', ({ sessionId, userId }) => {
        socket.to(`session-${sessionId}`).emit('user_typing', {
          userId,
          isTyping: false,
        });
      });

      // Plan modification
      socket.on('plan_modified', async ({ sessionId, userId, modifiedPlan }) => {
        try {
          // Check if user has ownership of the session
          const hasOwnership = await this.checkSessionOwnership(sessionId, userId);
          
          if (hasOwnership) {
            socket.to(`session-${sessionId}`).emit('plan_updated', {
              modifiedPlan,
              by: userId,
            });
          }
        } catch (error) {
          console.error('[WebSocket] Error modifying plan:', error);
        }
      });

      // Disconnect
      socket.on('disconnect', async () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        
        // Clean up presence for all sessions this socket was in
        try {
          await this.dbPool.query(
            'DELETE FROM agent_session_presence WHERE user_id IN (SELECT user_id FROM agent_session_presence WHERE last_seen < NOW() - INTERVAL \'5 minutes\')'
          );
        } catch (error) {
          console.error('[WebSocket] Error cleaning up presence:', error);
        }
      });
    });

    console.log('[WebSocket] Service initialized');
  },

  /**
   * Update user presence in a session
   */
  async updatePresence(sessionId, userId, isActive, socketId) {
    try {
      await this.dbPool.query(
        `INSERT INTO agent_session_presence (session_id, user_id, is_active, last_seen)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (session_id, user_id)
         DO UPDATE SET is_active = $3, last_seen = NOW()`,
        [sessionId, userId, isActive]
      );
    } catch (error) {
      console.error('[WebSocket] Error updating presence:', error);
    }
  },

  /**
   * Get current participants in a session
   */
  async getSessionParticipants(sessionId) {
    try {
      const result = await this.dbPool.query(
        `SELECT p.user_id, u.name, u.email, p.is_active, p.is_typing
         FROM agent_session_presence p
         JOIN users u ON p.user_id = u.id
         WHERE p.session_id = $1 AND p.is_active = true`,
        [sessionId]
      );

      return result.rows;
    } catch (error) {
      console.error('[WebSocket] Error getting participants:', error);
      return [];
    }
  },

  /**
   * Check if user has ownership of session
   */
  async checkSessionOwnership(sessionId, userId) {
    try {
      const result = await this.dbPool.query(
        'SELECT user_id FROM agent_chat_sessions WHERE id = $1',
        [sessionId]
      );

      return result.rowCount > 0 && result.rows[0].user_id === userId;
    } catch (error) {
      console.error('[WebSocket] Error checking ownership:', error);
      return false;
    }
  },

  /**
   * Broadcast message to session
   */
  broadcastToSession(sessionId, event, data) {
    if (this.io) {
      this.io.to(`session-${sessionId}`).emit(event, data);
    }
  },

  /**
   * Send notification to user
   */
  sendNotificationToUser(userId, notification) {
    if (this.io) {
      this.io.to(`user-${userId}`).emit('notification', notification);
    }
  },
};

