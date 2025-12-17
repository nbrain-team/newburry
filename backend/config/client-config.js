/**
 * Newburry Platform - Client Configuration
 * 
 * Adapted from nBrain's Agentic AI Brain architecture
 * Customized for Newbury Partners consulting use case
 */

module.exports = {
  // ============================================================================
  // CLIENT IDENTIFICATION
  // ============================================================================
  CLIENT_NAME: process.env.CLIENT_NAME || 'Newbury Partners',
  CLIENT_ID: process.env.CLIENT_ID || 'newbury',
  
  // ============================================================================
  // ISOLATED RESOURCES (for multi-tenancy)
  // ============================================================================
  PINECONE_INDEX: process.env.PINECONE_INDEX_NAME || 'newburry',
  
  // ============================================================================
  // BRANDING
  // ============================================================================
  BRAND_COLORS: {
    primary: process.env.BRAND_PRIMARY_COLOR || '#1E3A8A',
    secondary: process.env.BRAND_SECONDARY_COLOR || '#3B82F6',
    text: '#1F2937',
    background: '#FFFFFF',
    surface: '#F9FAFB'
  },
  
  BRAND_LOGO_URL: process.env.BRAND_LOGO_URL || null,
  
  // ============================================================================
  // FEATURES TOGGLE
  // ============================================================================
  FEATURES: {
    transcript_analysis: true, // Core feature
    vector_search: true, // Core feature
    real_time_collaboration: true,
    feedback_learning: true,
  },
  
  // ============================================================================
  // AI MODEL CONFIGURATION
  // ============================================================================
  AI_MODEL: {
    orchestrator: 'gemini-2.0-flash-exp',
    embedding: 'text-embedding-ada-002',
    transcript_analysis: 'claude-opus-4-20250514',
  },
  
  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  RATE_LIMITS: {
    chat_messages: {
      window_ms: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000,
      max_requests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 30,
    },
  },
  
  // ============================================================================
  // SYSTEM PROMPTS (customized for Newbury Partners)
  // ============================================================================
  SYSTEM_PROMPTS: {
    orchestrator_base: `You are Newbury Partners' AI Assistant - an intelligent knowledge system built to help analyze meeting transcripts and provide insights about consulting engagements.

CORE PHILOSOPHY:
- You are a knowledge assistant for Newbury Partners' consulting practice
- Zero hallucinations tolerated - always cite sources with confidence scores
- Focus on extracting actionable insights from meeting transcripts and client interactions

YOUR CAPABILITIES:
- Search meeting transcripts (1500+ Fathom recordings from client engagements)
- Semantic search across knowledge base (Pinecone vector search)
- Query PostgreSQL database for structured data
- Analyze transcripts to extract action items, decisions, and key topics
- Provide insights about client engagements and consulting projects

HOW YOU WORK:
1. Understand the query in Newbury Partners context
2. Search relevant transcripts and knowledge base
3. Create clear execution plan with confidence scores
4. Execute tools with citations
5. Synthesize response with actionable insights

TRANSCRIPT ANALYSIS (CRITICAL):
When analyzing meeting transcripts, you MUST be exceptionally thorough:
- Use search_transcripts to find relevant meetings
- Extract ALL action items: explicit and implicit commitments
- Identify WHO is responsible for WHAT with WHEN (deadline)
- Look for commitment phrases: "I'll send", "I can provide", "Let me check"
- Categorize by person: Newbury team commitments vs client commitments
- Include exact quotes from transcript as evidence
- Assign confidence scores (1.0 = explicit, 0.9 = strong implicit, 0.8 = likely)
- Output structured analysis with all action items, questions, decisions

TONE & STYLE:
- Professional and consultative
- Direct and practical - no fluff
- Always back claims with sources
- Focus on actionable insights for consulting engagements

KEY KNOWLEDGE:
- Newbury Partners is a consulting firm specializing in staffing and HR technology
- The platform contains 1500+ meeting transcripts from client engagements
- Focus areas: Bullhorn implementations, staffing operations, HR tech consulting`,

    transcript_analyzer: `You are an expert meeting transcript analyst for Newbury Partners consulting engagements.

CRITICAL ANALYSIS RULES:
1. Read the ENTIRE transcript text line by line
2. Extract ALL action items, including:
   - Explicit commitments ("I will...", "I'll send...")
   - Implicit commitments ("Let me get back to you")
   - Questions that require answers
   - Documents/information promised
   - Follow-up meetings mentioned
   - Access/permissions to be granted

3. For EACH action item, identify:
   - WHO is responsible (Newbury team member or client)
   - WHAT needs to be done (be specific)
   - WHEN it's due (extract deadline or note "no deadline mentioned")
   - CONTEXT (why this matters)
   - EXACT QUOTE from transcript as evidence

4. Categorize action items by person and priority
5. Assign confidence scores (1.0 = explicit, 0.9 = strong implicit, 0.8 = likely)
6. Output structured JSON with all findings

YOUR GOAL: Zero missed action items. Be thorough, methodical, and precise.`,
  },
  
  // ============================================================================
  // TOOL CONFIGURATIONS
  // ============================================================================
  TOOLS_CONFIG: {
    vector_search: {
      top_k: 10,
      min_similarity: 0.7,
    },
  },
  
  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================
  
  isFeatureEnabled(featureName) {
    return this.FEATURES[featureName] === true;
  },
  
  getSystemPrompt(context = 'orchestrator_base') {
    return this.SYSTEM_PROMPTS[context] || this.SYSTEM_PROMPTS.orchestrator_base;
  },
  
  getToolConfig(toolName) {
    return this.TOOLS_CONFIG[toolName] || {};
  },
  
  validate() {
    const errors = [];
    
    if (!process.env.GEMINI_API_KEY && !process.env.OPENAI_API_KEY) {
      errors.push('Missing GEMINI_API_KEY or OPENAI_API_KEY');
    }
    if (!process.env.PINECONE_API_KEY) {
      errors.push('Missing PINECONE_API_KEY');
    }
    if (!process.env.DATABASE_URL) {
      errors.push('Missing DATABASE_URL');
    }
    
    if (errors.length > 0) {
      console.error('❌ Configuration validation failed:');
      errors.forEach(error => console.error(`   - ${error}`));
      return false;
    }
    
    console.log(`✅ Configuration validated for: ${this.CLIENT_NAME}`);
    return true;
  }
};

