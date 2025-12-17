/**
 * Newburry Platform - Backend Server
 * 
 * AI-powered transcript analysis and knowledge management system
 * Built on nBrain's Agentic AI Brain architecture
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const path = require('path');
const { Server } = require('socket.io');
const http = require('http');

// Import services
const AgenticOrchestrator = require('./services/orchestrator');
const ToolRegistry = require('./services/toolRegistry');
const clientConfig = require('./config/client-config');

// Initialize Express app
const app = express();
const server = http.createServer(app);

console.log('📦 Newburry Platform starting...');

// ============================================================================
// CONFIGURATION
// ============================================================================

const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'newburry-secret-change-in-production';

// CORS configuration
const corsOptions = {
  origin: [
    'https://newburry-frontend.onrender.com',
    'http://localhost:3000',
    'http://localhost:3001',
    process.env.FRONTEND_URL
  ].filter(Boolean),
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));

console.log('✅ Middleware configured');

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL !== 'false' ? { rejectUnauthorized: false } : false,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: 10,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database pool error:', err);
});

console.log('✅ Database pool created');

// ============================================================================
// ENSURE BASIC SCHEMA
// ============================================================================

async function ensureBasicSchema() {
  try {
    // Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user')),
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create projects table (for organizing transcripts)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS projects (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ Basic schema ensured');
  } catch (error) {
    console.error('❌ Error ensuring basic schema:', error);
    throw error;
  }
}

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

function auth() {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        return res.status(401).json({ error: 'No token provided' });
      }

      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.userId || decoded.id;
      req.userRole = decoded.role;
      
      next();
    } catch (error) {
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/ping', (_req, res) => {
  res.status(200).send('pong');
});

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'unhealthy',
      database: 'disconnected',
      error: error.message
    });
  }
});

console.log('✅ Health check endpoints registered');

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  const { name, email, username, password, role = 'user' } = req.body;
  
  try {
    const bcrypt = require('bcrypt');
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      `INSERT INTO users (name, email, username, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, username, role`,
      [name, email, username, hashedPassword, role]
    );
    
    const user = result.rows[0];
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      user,
      token
    });
  } catch (error) {
    console.error('[Auth] Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const bcrypt = require('bcrypt');
    const validPassword = await bcrypt.compare(password, user.password);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        username: user.username,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('[Auth] Login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', auth(), async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, username, role FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

console.log('✅ Auth endpoints registered');

// ============================================================================
// INITIALIZE AI AGENT SYSTEM
// ============================================================================

let orchestrator = null;
let toolRegistry = null;

async function initializeAgentSystem() {
  try {
    console.log('🤖 Initializing AI Agent System...');
    
    // Validate configuration
    clientConfig.validate();
    
    // Initialize tool registry
    toolRegistry = new ToolRegistry();
    
    // Load tools from directory
    const toolsDir = path.join(__dirname, 'tools');
    toolRegistry.loadToolsFromDirectory(toolsDir);
    
    // Initialize orchestrator
    orchestrator = new AgenticOrchestrator(pool, toolRegistry);
    
    console.log('✅ AI Agent System initialized');
    console.log(`   - Tools loaded: ${toolRegistry.listTools().length}`);
    console.log(`   - Model: ${clientConfig.AI_MODEL.orchestrator}`);
    
  } catch (error) {
    console.error('❌ Failed to initialize AI Agent System:', error);
    throw error;
  }
}

// ============================================================================
// AGENT CHAT ROUTES
// ============================================================================

// Mount agent routes
const agentRoutes = require('./routes/index')(pool, orchestrator, toolRegistry);
app.use('/api/agent-chat', agentRoutes);

console.log('✅ Agent chat routes mounted at /api/agent-chat');

// ============================================================================
// TRANSCRIPT ENDPOINTS
// ============================================================================

// Get all transcripts
app.get('/api/transcripts', auth(), async (req, res) => {
  const { limit = 50, offset = 0, search, client_id } = req.query;
  
  try {
    let query = `
      SELECT 
        mt.id,
        mt.title,
        mt.scheduled_at,
        mt.duration_seconds,
        mt.summary,
        mt.participants,
        mt.topics,
        mt.action_items,
        mt.assignment_status,
        c.name as client_name
      FROM meeting_transcripts mt
      LEFT JOIN users c ON mt.client_id = c.id
      WHERE 1=1
    `;
    
    const params = [];
    let paramIndex = 1;
    
    if (search) {
      query += ` AND (
        mt.title ILIKE $${paramIndex} OR 
        mt.summary ILIKE $${paramIndex} OR
        mt.transcript_text ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    
    if (client_id) {
      query += ` AND mt.client_id = $${paramIndex}`;
      params.push(client_id);
      paramIndex++;
    }
    
    query += ` ORDER BY mt.scheduled_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    const result = await pool.query(query, params);
    
    res.json({
      success: true,
      transcripts: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[Transcripts] Error fetching:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get single transcript with full details
app.get('/api/transcripts/:id', auth(), async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT 
        mt.*,
        c.name as client_name,
        c.email as client_email
      FROM meeting_transcripts mt
      LEFT JOIN users c ON mt.client_id = c.id
      WHERE mt.id = $1`,
      [id]
    );
    
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    
    res.json({
      success: true,
      transcript: result.rows[0]
    });
  } catch (error) {
    console.error('[Transcripts] Error fetching transcript:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search transcripts
app.post('/api/transcripts/search', auth(), async (req, res) => {
  const { query, limit = 10 } = req.body;
  
  try {
    const result = await pool.query(
      `SELECT 
        mt.id,
        mt.title,
        mt.scheduled_at,
        mt.summary,
        mt.participants,
        c.name as client_name,
        ts_rank(to_tsvector('english', 
          COALESCE(mt.title, '') || ' ' || 
          COALESCE(mt.transcript_text, '') || ' ' || 
          COALESCE(mt.summary, '')
        ), plainto_tsquery('english', $1)) as relevance
      FROM meeting_transcripts mt
      LEFT JOIN users c ON mt.client_id = c.id
      WHERE to_tsvector('english', 
        COALESCE(mt.title, '') || ' ' || 
        COALESCE(mt.transcript_text, '') || ' ' || 
        COALESCE(mt.summary, '')
      ) @@ plainto_tsquery('english', $1)
      ORDER BY relevance DESC, mt.scheduled_at DESC
      LIMIT $2`,
      [query, limit]
    );
    
    res.json({
      success: true,
      transcripts: result.rows,
      count: result.rowCount
    });
  } catch (error) {
    console.error('[Transcripts] Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

console.log('✅ Transcript endpoints registered');

// ============================================================================
// WEBSOCKET FOR REAL-TIME AGENT CHAT
// ============================================================================

const io = new Server(server, {
  cors: corsOptions,
  transports: ['websocket', 'polling']
});

io.on('connection', (socket) => {
  console.log(`[WebSocket] Client connected: ${socket.id}`);
  
  socket.on('join-session', (sessionId) => {
    socket.join(`session-${sessionId}`);
    console.log(`[WebSocket] Client joined session: ${sessionId}`);
  });
  
  socket.on('leave-session', (sessionId) => {
    socket.leave(`session-${sessionId}`);
    console.log(`[WebSocket] Client left session: ${sessionId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`[WebSocket] Client disconnected: ${socket.id}`);
  });
});

console.log('✅ WebSocket server initialized');

// ============================================================================
// ERROR HANDLING
// ============================================================================

app.use((err, req, res, next) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================

async function startServer() {
  try {
    // Test database connection
    console.log('🔌 Testing database connection...');
    await pool.query('SELECT NOW()');
    console.log('✅ Database connected');
    
    // Ensure basic schema
    await ensureBasicSchema();
    
    // Run migrations
    console.log('🔄 Running migrations...');
    await runMigrations();
    console.log('✅ Migrations complete');
    
    // Initialize AI agent system
    await initializeAgentSystem();
    
    // Start server
    server.listen(PORT, '0.0.0.0', () => {
      console.log('');
      console.log('🚀 =====================================');
      console.log(`🚀 Newburry Platform Backend`);
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🚀 Client: ${clientConfig.CLIENT_NAME}`);
      console.log('🚀 =====================================');
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// ============================================================================
// MIGRATIONS RUNNER
// ============================================================================

async function runMigrations() {
  const fs = require('fs');
  const migrationsDir = path.join(__dirname, 'migrations');
  
  try {
    // Create migrations tracking table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    
    // Get list of migration files
    const files = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort();
    
    for (const file of files) {
      // Check if already executed
      const check = await pool.query(
        'SELECT id FROM migrations WHERE name = $1',
        [file]
      );
      
      if (check.rowCount > 0) {
        console.log(`   ⏭️  Skipping ${file} (already executed)`);
        continue;
      }
      
      // Read and execute migration
      const migrationPath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      console.log(`   ▶️  Executing ${file}...`);
      await pool.query(sql);
      
      // Mark as executed
      await pool.query(
        'INSERT INTO migrations (name) VALUES ($1)',
        [file]
      );
      
      console.log(`   ✅ Completed ${file}`);
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

// ============================================================================
// GRACEFUL SHUTDOWN
// ============================================================================

process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server gracefully...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

// Start the server
startServer().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

