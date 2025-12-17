/**
 * Agentic AI Brain - Main Orchestrator
 * 
 * The orchestrator is the brain of the system. It:
 * 1. Analyzes user queries
 * 2. Generates execution plans
 * 3. Coordinates tool execution
 * 4. Synthesizes responses with citations
 * 5. Manages memory (short-term & long-term)
 * 
 * Powered by Google Gemini
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (error) {
  console.warn('[Orchestrator] Anthropic SDK not available - Claude Opus will not be used for transcript analysis');
  console.warn('[Orchestrator] Install with: npm install @anthropic-ai/sdk');
}
const clientConfig = require('../config/client-config');
const UserProfileService = require('./userProfileService');

class AgenticOrchestrator {
  constructor(dbPool, toolRegistry, analysisQueue = null) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ CRITICAL: GEMINI_API_KEY is missing in Orchestrator!');
    } else {
      console.log(`✅ Orchestrator initialized with Gemini Key (length: ${apiKey.length})`);
    }
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.modelName = 'claude-sonnet-4.5'; // Use Claude Sonnet 4.5 for everything
    console.log(`✅ Orchestrator using model: ${this.modelName}`);
    
    // Initialize Anthropic for transcript analysis
    if (Anthropic && process.env.ANTHROPIC_API_KEY) {
      try {
        this.anthropic = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        console.log('✅ Orchestrator: Claude Opus available for transcript analysis');
      } catch (error) {
        console.warn('⚠️  Orchestrator: Failed to initialize Anthropic:', error.message);
        this.anthropic = null;
      }
    } else {
      if (!Anthropic) {
        console.log('⚠️  Orchestrator: Anthropic SDK not installed - will use Gemini for all tasks');
      } else if (!process.env.ANTHROPIC_API_KEY) {
        console.log('⚠️  Orchestrator: ANTHROPIC_API_KEY not set - will use Gemini for all tasks');
      }
      this.anthropic = null;
    }
    
    this.dbPool = dbPool;
    this.toolRegistry = toolRegistry;
    this.analysisQueue = analysisQueue;
    this.userProfileService = new UserProfileService(dbPool);
  }

  /**
   * Process a user query through the full orchestration pipeline
   */
  async processQuery(params) {
    const {
      userMessage,
      conversationHistory = [],
      sessionId,
      userId,
      clientId = null,
      projectId = null,
      streamCallback = null,
    } = params;

    console.log(`[Orchestrator] Processing query: "${userMessage.substring(0, 50)}..." (Session: ${sessionId})`);

    try {
      // Step 1: Get user preferences (long-term memory)
      const userPreferences = await this.getUserPreferences(userId);

      // Step 1.5: Get user personalization profile (graceful fallback if not available)
      let userProfile = null;
      try {
        userProfile = await this.userProfileService.getUserProfile(userId);
      } catch (profileError) {
        console.warn('[Orchestrator] User profile not available, using defaults:', profileError.message);
        // Continue without personalization - AI will work with defaults
      }

      // Step 2: Analyze intent and generate execution plan
      const plan = await this.generateExecutionPlan({
        userMessage,
        conversationHistory,
        userPreferences,
        userProfile,
      });

      // Step 3: Stream plan to user (if callback provided)
      if (streamCallback) {
        await streamCallback({
          type: 'plan',
          data: plan,
        });
      }

      // Step 4: Wait for plan approval/modification (handled externally)
      // This function assumes plan is already approved when called
      // For interactive modification, call modifyPlan() separately

      // Step 5: Execute tools in sequence
      const executionResults = await this.executePlan({
        plan,
        userId,
        clientId,
        projectId,
        sessionId,
        streamCallback,
      });

      // Step 6: Synthesize final response with citations
      const response = await this.synthesizeResponse({
        userMessage,
        plan,
        executionResults,
        conversationHistory,
        userPreferences,
        userProfile,
        streamCallback,
      });

      // Step 7: Save message to database
      await this.saveMessage({
        sessionId,
        role: 'user',
        content: userMessage,
      });

      // Check if any tool returned a job_id (async job)
      const asyncJob = executionResults.find(r => r.data && r.data.job_id);
      const jobId = asyncJob?.data?.job_id || null;
      const jobStatus = asyncJob?.data?.status || null;

      await this.saveMessage({
        sessionId,
        role: 'assistant',
        content: response.content,
        model_used: this.modelName,
        tokens_used: response.tokensUsed,
        plan_json: plan,
        tool_calls: executionResults.map(r => r.toolCall),
        sources: executionResults.map(r => r.source),
        job_id: jobId,
        job_status: jobStatus,
      });

      // Step 8: Update memory
      await this.updateMemory({
        userId,
        userMessage,
        response: response.content,
        executionResults,
      });

      console.log(`[Orchestrator] Query processed successfully. Response length: ${response.content.length}`);

      return {
        success: true,
        response: response.content,
        plan,
        sources: executionResults.map(r => r.source),
        tokensUsed: response.tokensUsed,
      };

    } catch (error) {
      console.error('[Orchestrator] Error processing query:', error);
      
      // Save error message
      if (sessionId) {
        await this.saveMessage({
          sessionId,
          role: 'assistant',
          content: 'I encountered an error processing your request. Please try again or rephrase your question.',
        });
      }

      throw error;
    }
  }

  /**
   * Generate execution plan from user query
   */
  async generateExecutionPlan(params) {
    const { userMessage, conversationHistory, userPreferences, userProfile } = params;

    // Build system prompt with full tool descriptions
    const availableTools = this.toolRegistry.getToolDescriptions();
    const toolsJson = JSON.stringify(availableTools, null, 2);
    
    // Current date/time context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const currentTime = now.toLocaleTimeString('en-US');
    
    // Add user personalization to system prompt
    const personalizationContext = this.userProfileService.formatForPrompt(userProfile || {});

    const systemPrompt = `${clientConfig.getSystemPrompt('orchestrator_base')}

CURRENT DATE AND TIME:
- Today is: ${currentDate}
- Current time:${personalizationContext ? '\n' + personalizationContext : ''} ${currentTime}
- ISO timestamp: ${now.toISOString()}

When users say "this week", "today", "yesterday", "recent", calculate dates based on the current date above.
Example: If today is December 5, 2025, "this week" means December 1-7, 2025.

User Preferences:
${this.formatUserPreferences(userPreferences)}

Your task is to create a detailed execution plan for the user's query. Return a JSON object with this structure:
{
  "understanding": "Brief summary of what the user wants",
  "steps": [
    {
      "tool": "tool_name",
      "params": {...},
      "reason": "Why this step is needed",
      "confidence": 0.9
    }
  ],
  "estimated_time": "10 seconds",
  "requires_approval": ["gmail_send", "task_create"]
}

Available tools (with descriptions and parameters):
${toolsJson}

CRITICAL TOOL SELECTION RULES:
- When user mentions "transcript", "meeting", "call", "discussion", or asks to analyze conversations → USE search_transcripts or get_recent_transcripts FIRST
- When user says "analyze the transcript" or "summarize our call" → ONLY use search_transcripts, DO NOT use get_crm_data
- When user says "create a task" or "add a task" → USE task_create tool, NOT database_query
- When user says "search for" or "find" information → USE appropriate search tool (email_search, drive_search, vector_search)
- When user says "send an email" → USE gmail_send or gmail_draft
- When user says "reply to email" → USE email_search (to find original) THEN gmail_draft (with in_reply_to)
- When user wants data analysis → USE python_execute  
- NEVER use database_query for task creation - that's what task_create is for!
- TRANSCRIPT SEARCH PRIORITY: If query mentions transcripts, meetings, or calls, ALWAYS prioritize transcript search tools over CRM/database tools

CRITICAL TRANSCRIPT SEARCH QUERY EXTRACTION:
- When extracting query for search_transcripts, use ONLY the CLIENT NAME or MEETING TOPIC
- DO NOT include the user's own name (Danny DeMichele, etc.) in the search query
- Example: "analyze transcript with Newbury Partners from today" → query: "Newbury Partners"
- Example: "what did I commit to in the Seagate call" → query: "Seagate"
- DO NOT use: "Newbury Partners Danny DeMichele" - this is too specific and won't match!

CLIENT UPLOADED CONTENT SEARCH RULES:
- Questions about "how we create products", "our methodology", "how we sell" → SEARCH client uploads with vector_search
- Email responses needing past proposal context → SEARCH uploads tagged "proposal"
- Questions about pricing or cost → SEARCH uploads tagged "pricing"
- When creating proposals/documents → SEARCH uploads for templates and examples
- Use vector_search with filter: { source_type: 'data_upload', tags: 'relevant-tag' } or just { source_type: 'data_upload' } for general search
- Common upload tags: "proposal", "sales", "methodology", "pricing", "product-creation"
- ALWAYS mention the source document when using uploaded content in responses

CRITICAL PARAMETER USAGE RULES:
- task_create: Use client_name (string like "Opticwise") OR client_email, NOT client_id unless you have the numeric ID
- email_search: Use client_email to filter, not client_id
- drive_search: Use query for search terms
- All date/time values must be ISO format: 2025-12-31T10:00:00Z
- Priority values for tasks: low, medium, high, urgent
- Status values for tasks: pending, in_progress, completed, archived

VARIABLE SUBSTITUTION:
- You can reference results from previous steps using syntax $stepN.data.field
- Example: If step 1 is email_search, step 2 can use in_reply_to: "$step1.data.emails[0].message_id"
- This allows you to chain tools together dynamically (e.g. search -> reply)
- ALWAYS use this for email replies when you don't have the message ID yet!

Use the exact tool names and parameter names as specified above.
RETURN ONLY JSON.`;

    // Use Claude Sonnet 4.5 for planning (fast and accurate)
    if (this.anthropic) {
      const messages = [
        ...this.formatConversationHistoryForClaude(conversationHistory),
        {
          role: 'user',
          content: userMessage,
        },
      ];

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: systemPrompt,
        messages: messages,
      });

      const planText = response.content[0].text;
      const plan = this.extractJSON(planText);

      return {
        ...plan,
        created_at: new Date().toISOString(),
        tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      };
    } else {
      // Fallback to Gemini if Claude not available
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-2.0-flash-exp',
        systemInstruction: systemPrompt 
      });

      const chat = model.startChat({
        history: this.formatConversationHistory(conversationHistory),
      });

      const result = await chat.sendMessage(userMessage);
      const planText = result.response.text();
      const plan = this.extractJSON(planText);

      return {
        ...plan,
        created_at: new Date().toISOString(),
        tokens_used: 0,
      };
    }
  }

  /**
   * Execute the approved plan
   */
  async executePlan(params) {
    const { plan, userId, clientId, projectId, sessionId, streamCallback } = params;
    const results = [];

    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      
      // Stream progress
      if (streamCallback) {
        await streamCallback({
          type: 'progress',
          data: {
            step: i + 1,
            total: plan.steps.length,
            tool: step.tool,
            status: 'executing',
          },
        });
      }

      try {
        // Get tool from registry
        const tool = this.toolRegistry.getTool(step.tool);
        
        if (!tool) {
          throw new Error(`Tool not found: ${step.tool}`);
        }

        // Execute tool
        const context = {
          userId,
          clientId,
          projectId,
          sessionId,
          dbPool: this.dbPool,
          analysisQueue: this.analysisQueue,
        };

        // RESOLVE PARAMETERS WITH VARIABLE SUBSTITUTION
        const resolvedParams = { ...step.params };
        
        for (const [key, value] of Object.entries(resolvedParams)) {
          if (typeof value === 'string' && value.startsWith('$step')) {
            // Parse reference: $step1.data.emails[0].message_id
            try {
              const pathParts = value.substring(1).split('.'); // ['step1', 'data', 'emails[0]', 'message_id']
              const stepRef = pathParts[0]; // 'step1'
              const stepIndex = parseInt(stepRef.replace('step', '')) - 1; // 0
              
              if (stepIndex >= 0 && stepIndex < i && results[stepIndex]) {
                const prevResult = results[stepIndex];
                
                // Navigate the object path
                let currentVal = prevResult;
                for (let j = 1; j < pathParts.length; j++) {
                  let part = pathParts[j];
                  
                  // Handle array syntax: emails[0] -> emails, 0
                  const arrayMatch = part.match(/^([a-zA-Z0-9_]+)\[(\d+)\]$/);
                  if (arrayMatch) {
                    const arrayName = arrayMatch[1];
                    const arrayIdx = parseInt(arrayMatch[2]);
                    currentVal = currentVal[arrayName][arrayIdx];
                  } else {
                    currentVal = currentVal[part];
                  }
                  
                  if (currentVal === undefined) break;
                }
                
                if (currentVal !== undefined) {
                  resolvedParams[key] = currentVal;
                  console.log(`[Orchestrator] Resolved ${key}: ${value} -> ${currentVal}`);
                } else {
                  console.warn(`[Orchestrator] Could not resolve variable: ${value}`);
                }
              }
            } catch (err) {
              console.error(`[Orchestrator] Error resolving variable ${value}:`, err);
            }
          }
        }

        // Stream progress before executing tool
        if (streamCallback) {
          await streamCallback({
            type: 'tool_start',
            data: {
              step: i + 1,
              tool: step.tool,
              total_steps: plan.steps.length,
            },
          });
        }

        const result = await tool.execute(resolvedParams, context);

        results.push({
          step: i + 1,
          toolCall: {
            tool: step.tool,
            params: step.params,
            reason: step.reason,
          },
          data: result.data,
          success: result.success,
          source: {
            type: result.source_type || 'unknown',
            confidence: result.confidence || 0.5,
            data_points: result.data_points || [],
          },
        });

        // Stream result
        if (streamCallback) {
          await streamCallback({
            type: 'tool_result',
            data: {
              step: i + 1,
              tool: step.tool,
              success: result.success,
              summary: this.summarizeToolResult(result),
            },
          });
        }

      } catch (error) {
        console.error(`[Orchestrator] Tool execution error (${step.tool}):`, error);
        
        results.push({
          step: i + 1,
          toolCall: {
            tool: step.tool,
            params: step.params,
          },
          result: null,
          success: false,
          error: error.message,
          source: {
            type: 'error',
            confidence: 0,
          },
        });

        // Stream error
        if (streamCallback) {
          await streamCallback({
            type: 'tool_error',
            data: {
              step: i + 1,
              tool: step.tool,
              error: error.message,
            },
          });
        }
      }
    }

    return results;
  }

  /**
   * Synthesize final response from execution results
   */
  async synthesizeResponse(params) {
    const {
      userMessage,
      plan,
      executionResults,
      conversationHistory,
      userPreferences,
      userProfile,
      streamCallback,
    } = params;

    // Stream progress - starting synthesis
    if (streamCallback) {
      await streamCallback({
        type: 'progress',
        data: {
          message: 'Analyzing results and preparing response...',
        },
      });
    }

    // Check if this is a transcript analysis query
    const isTranscriptAnalysis = this.isTranscriptAnalysisQuery(userMessage, executionResults);
    
    // If transcript analysis, perform verification step
    if (isTranscriptAnalysis && streamCallback) {
      await streamCallback({
        type: 'progress',
        data: {
          step: 'verification',
          status: 'Performing verification pass to ensure no action items were missed...',
        },
      });
    }

    // Build context from execution results
    const resultsContext = executionResults.map((r, i) => {
      return `Step ${r.step}: ${r.toolCall.tool}
Result: ${r.success ? JSON.stringify(r.data, null, 2) : 'Failed: ' + r.error}
Source: ${r.source.type} (confidence: ${r.source.confidence})`;
    }).join('\n\n');
    
    // Current date context
    const now = new Date();
    const currentDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    const personalizationContext = this.userProfileService.formatForPrompt(userProfile || {});

    // Add verification instructions for transcript analysis
    const verificationInstructions = isTranscriptAnalysis ? `

TRANSCRIPT ANALYSIS VERIFICATION (CRITICAL):
Before providing your final response, you MUST perform a verification check:
1. Review the action items extracted - did we miss any?
2. Check for implicit commitments (phrases like "I'll", "Let me", "I can")
3. Look for questions that need answers
4. Verify every person mentioned has their commitments listed
5. Ensure no action item is too vague - be specific about WHO, WHAT, WHEN
6. Double-check for: documents promised, access to grant, introductions to make, reviews needed
7. If you find ANY missed items, add them to your response with a note: "Additional items found in verification:"

Ask yourself: "If I were in this meeting, what would I write down as follow-ups?"` : '';

    const systemPrompt = `${clientConfig.getSystemPrompt('orchestrator_base')}

CURRENT DATE: ${currentDate} (${now.toISOString()})
${personalizationContext}
User Preferences:
${this.formatUserPreferences(userPreferences)}

Based on the execution results below, provide a comprehensive answer to the user's question.

CRITICAL FORMATTING RULES:
- DO NOT include any XML tags, function calls, or tool invocation syntax in your response
- DO NOT show <function_calls>, <invoke>, or any similar XML-style markup
- The tools have ALREADY been executed - just describe what was done
- DO NOT show the raw JSON or technical details of tool execution

CRITICAL RESPONSE STYLE (MUST FOLLOW - NON-NEGOTIABLE):

**FORBIDDEN PHRASES - NEVER USE THESE:**
- ❌ "I searched the knowledge base but didn't find..."
- ❌ "I don't have specific details..."
- ❌ "I'm not certain..."
- ❌ "I cannot confirm..."
- ❌ "I don't know..."
- ❌ "Based on limited information..."
- ❌ "While I don't have..."
- ❌ "However, I can describe generally..."
- ❌ Any phrase that starts with uncertainty or disclaimers

**REQUIRED STYLE:**
- ✅ Start IMMEDIATELY with the answer - no preamble, no disclaimers
- ✅ Write as if you're an expert who knows the answer (because you have search results)
- ✅ Be direct, confident, and authoritative
- ✅ State facts naturally without qualifying them upfront
- ✅ If you searched and found nothing, present what you DO know from context
- ✅ Place ALL source citations at the very END in a "Sources:" section
- ✅ Let the confidence scores in the sources section indicate certainty - not your language

**CORRECT EXAMPLE:**
"Newbury Partners' Bullhorn implementations include comprehensive change management support. The approach focuses on user adoption through hands-on training, phased rollouts, and ongoing support. The 30-day implementation timeline includes dedicated time for team onboarding and process optimization to minimize disruption.

Key components of the change management process include:
- Executive stakeholder alignment
- End-user training programs
- Process documentation
- Go-live support
- Post-implementation optimization

---
Sources:
- [Website: Bullhorn Implementation] (Confidence: 0.92)
- [Website: About Us] (Confidence: 0.85)"

**WRONG EXAMPLE:**
"I searched the knowledge base for information about change management but didn't find specific details. However, I can describe generally..."

RESPONSE STRUCTURE:
1. Direct answer to the question (confident, natural, no disclaimers)
2. Key details and findings
3. Actionable next steps if relevant
4. Sources section at the end with confidence scores

CITATION FORMAT (at the end only):
---
Sources:
- [Source Type: Title/Description] (Confidence: X.XX)
- [Source Type: Title/Description] (Confidence: X.XX)

IMPORTANT:
- Highlight key findings naturally in the response
- Suggest next steps if appropriate
- If any tool failed, work around it - don't mention the failure unless critical
- If tasks were created, EXPLICITLY LIST each task
- Always acknowledge completed actions
- Present information in a clean, professional format
${verificationInstructions}

Execution Results:
${resultsContext}`;

    // Use Claude Opus for transcript analysis if available, otherwise use Gemini
    const useClaude = isTranscriptAnalysis && this.anthropic && process.env.ANTHROPIC_API_KEY;
    
    // Always use Claude Sonnet 4.5 for fast, high-quality synthesis
    console.log('[Orchestrator] Starting synthesis with Claude Sonnet 4.5...');
    
    // Add timeout protection to synthesis (45 seconds max)
    const synthesisTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Synthesis timeout after 45 seconds')), 45000);
    });

    const synthesisPromise = this.synthesizeWithClaude({ 
      systemPrompt, 
      userMessage, 
      conversationHistory, 
      streamCallback,
      model: 'claude-sonnet-4-20250514' // Use Sonnet 4.5 (fast and smart)
    });

    try {
      return await Promise.race([synthesisPromise, synthesisTimeout]);
    } catch (error) {
      if (error.message.includes('timeout')) {
        console.error('[Orchestrator] Synthesis timeout - returning partial response');
        
        // Return a basic response on timeout
        return {
          content: 'I found relevant information but the synthesis took too long. Here are the key findings from the search results. Please try a more specific query for detailed analysis.',
          tokensUsed: 0,
        };
      }
      throw error;
    }
  }

  /**
   * Synthesize response using Claude (Sonnet 4.5 or Opus)
   */
  async synthesizeWithClaude({ systemPrompt, userMessage, conversationHistory, streamCallback, model = 'claude-sonnet-4-20250514' }) {
    try {
      // Send progress update before starting synthesis
      if (streamCallback) {
        await streamCallback({
          type: 'progress',
          data: {
            message: 'Generating response...',
          },
        });
      }

      // Format conversation history for Claude
      const messages = [
        ...this.formatConversationHistoryForClaude(conversationHistory),
        {
          role: 'user',
          content: userMessage,
        },
      ];

      if (streamCallback) {
        let fullResponse = '';
        
        const stream = await this.anthropic.messages.stream({
          model: model, // Use Sonnet 4.5 for speed
          max_tokens: 4000, // Reduced for faster response
          system: systemPrompt,
          messages: messages,
        });

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            const chunkText = chunk.delta.text;
            fullResponse += chunkText;
            
            await streamCallback({
              type: 'response_chunk',
              data: { content: chunkText },
            });
          }
        }

        return {
          content: fullResponse,
          tokensUsed: 0,
          model: model,
        };
      } else {
        const response = await this.anthropic.messages.create({
          model: model,
          max_tokens: 4000,
          system: systemPrompt,
          messages: messages,
        });

        return {
          content: response.content[0].text,
          tokensUsed: response.usage?.input_tokens + response.usage?.output_tokens || 0,
          model: model,
        };
      }
    } catch (error) {
      console.error('[Orchestrator] Claude synthesis error:', error);
      console.log('[Orchestrator] Falling back to Gemini');
      return await this.synthesizeWithGemini({ systemPrompt, userMessage, conversationHistory, streamCallback });
    }
  }

  /**
   * Synthesize response using Gemini (default)
   */
  async synthesizeWithGemini({ systemPrompt, userMessage, conversationHistory, streamCallback }) {
    const model = this.genAI.getGenerativeModel({ 
      model: this.modelName,
      systemInstruction: systemPrompt 
    });

    const chat = model.startChat({
      history: this.formatConversationHistory(conversationHistory),
    });

    if (streamCallback) {
      let fullResponse = '';
      
      const result = await chat.sendMessageStream(userMessage);

      for await (const chunk of result.stream) {
        const chunkText = chunk.text();
        fullResponse += chunkText;
        
        await streamCallback({
          type: 'response_chunk',
          data: { content: chunkText },
        });
      }

      return {
        content: fullResponse,
        tokensUsed: 0,
        model: 'gemini',
      };

    } else {
      const result = await chat.sendMessage(userMessage);
      return {
        content: result.response.text(),
        tokensUsed: 0,
        model: 'gemini',
      };
    }
  }

  /**
   * Format conversation history for Claude
   */
  formatConversationHistoryForClaude(conversationHistory) {
    if (!conversationHistory || conversationHistory.length === 0) {
      return [];
    }

    return conversationHistory.map(msg => ({
      role: msg.role === 'model' ? 'assistant' : 'user',
      content: msg.parts?.[0]?.text || msg.content || '',
    }));
  }

  /**
   * Check if this is a transcript analysis query
   */
  isTranscriptAnalysisQuery(userMessage, executionResults) {
    const transcriptKeywords = ['transcript', 'meeting', 'call', 'action item', 'follow up', 'follow-up', 'commitment'];
    const messageContainsKeyword = transcriptKeywords.some(keyword => 
      userMessage.toLowerCase().includes(keyword)
    );
    
    const usedTranscriptTools = executionResults.some(result => 
      result.toolCall.tool === 'search_transcripts' || 
      result.toolCall.tool === 'analyze_transcript_deeply' ||
      result.toolCall.tool === 'get_recent_transcripts'
    );
    
    return messageContainsKeyword || usedTranscriptTools;
  }

  /**
   * Get user preferences from database
   */
  async getUserPreferences(userId) {
    try {
      const result = await this.dbPool.query(
        `SELECT preference_key, preference_value, confidence_score 
         FROM agent_user_preferences 
         WHERE user_id = $1 
         ORDER BY confidence_score DESC`,
        [userId]
      );

      const preferences = {};
      result.rows.forEach(row => {
        preferences[row.preference_key] = {
          value: row.preference_value,
          confidence: row.confidence_score,
        };
      });

      return preferences;
    } catch (error) {
      console.error('[Orchestrator] Error fetching user preferences:', error);
      return {};
    }
  }

  /**
   * Update long-term memory based on interaction
   */
  async updateMemory(params) {
    const { userId, userMessage, response, executionResults } = params;
    
    const toolUsage = {};
    executionResults.forEach(result => {
      const tool = result.toolCall.tool;
      toolUsage[tool] = (toolUsage[tool] || 0) + 1;
    });

    if (userId && typeof userId === 'number') {
      for (const [tool, count] of Object.entries(toolUsage)) {
        if (count >= 2) {
          try {
            await this.dbPool.query(
              `INSERT INTO agent_user_preferences (user_id, preference_key, preference_value, confidence_score)
               VALUES ($1, $2, $3, $4)
               ON CONFLICT (user_id, preference_key) 
               DO UPDATE SET preference_value = $3, confidence_score = LEAST(agent_user_preferences.confidence_score + 0.1, 1.0), updated_at = NOW()`,
              [userId, `frequent_tool_${tool}`, 'true', 0.6]
            );
          } catch (prefError) {
            console.warn(`[Orchestrator] Could not save tool preference for user ${userId}:`, prefError.message);
          }
        }
      }
    }
  }

  /**
   * Save message to database
   */
  async saveMessage(params) {
    const {
      sessionId,
      role,
      content,
      model_used = null,
      tokens_used = null,
      plan_json = null,
      tool_calls = null,
      sources = null,
      job_id = null,
      job_status = null,
    } = params;

    if (!sessionId) {
      return;
    }

    try {
      await this.dbPool.query(
        `INSERT INTO agent_chat_messages 
         (session_id, role, content, model_used, tokens_used, plan_json, tool_calls, sources, job_id, job_status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [sessionId, role, content, model_used, tokens_used, 
         plan_json ? JSON.stringify(plan_json) : null,
         tool_calls ? JSON.stringify(tool_calls) : null,
         sources ? JSON.stringify(sources) : null,
         job_id,
         job_status]
      );
    } catch (error) {
      if (!error.message.includes('session_id')) {
        console.error('[Orchestrator] Error saving message:', error.message);
      }
    }
  }

  /**
   * Helper: Format user preferences for prompts
   */
  formatUserPreferences(preferences) {
    if (!preferences || Object.keys(preferences).length === 0) {
      return 'No specific preferences recorded yet.';
    }

    return Object.entries(preferences)
      .map(([key, data]) => `- ${key}: ${data.value} (confidence: ${data.confidence.toFixed(2)})`)
      .join('\n');
  }

  /**
   * Helper: Format conversation history for Gemini
   */
  formatConversationHistory(history) {
    // Gemini roles: 'user' or 'model'
    return history.map(msg => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    }));
  }

  /**
   * Helper: Extract JSON from Gemini response
   */
  extractJSON(text) {
    try {
      // Try to find JSON in code blocks
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Try to find JSON in plain code blocks
      const codeMatch = text.match(/```([\s\S]*?)```/);
      if (codeMatch) {
        try {
            return JSON.parse(codeMatch[1]);
        } catch (e) {
            // ignore
        }
      }

      // Try to parse the whole text as JSON
      return JSON.parse(text);
    } catch (error) {
      console.error('[Orchestrator] Failed to parse JSON:', error);
      // Return a default plan if parsing fails
      return {
        understanding: 'Failed to parse execution plan',
        steps: [],
        estimated_time: 'unknown',
        requires_approval: [],
      };
    }
  }

  /**
   * Helper: Summarize tool result for streaming
   */
  summarizeToolResult(result) {
    if (!result.success) {
      return `Failed: ${result.error || 'Unknown error'}`;
    }

    if (typeof result.data === 'object') {
      const keys = Object.keys(result.data);
      return `Success: ${keys.length} data points returned`;
    }

    return 'Success';
  }

  /**
   * Helper: Get tool usage guidance for plan generation
   */
  getToolUsageGuidance() {
    return `
TOOL PARAMETER GUIDANCE:

task_create:
- If you have a client NAME (like "Opticwise" or "John's Company"), use client_name parameter
- If you have a client EMAIL, use client_email parameter  
- ONLY use client_id if you have the actual numeric ID
- Priority values: low, medium, high, urgent
- Status values: pending, in_progress, completed, archived
- Due date must be ISO format: 2025-12-31T10:00:00Z

email_search:
- Use client_id OR client_email to filter by client
- Query parameter for keyword search
- Time range: from_date and to_date in ISO format

drive_search:
- Query parameter for search terms
- File types: pdf, doc, docx, xlsx, pptx, etc.

IMPORTANT:
- Always use the correct parameter names exactly as specified in the tool definitions
- Use client_name or client_email for lookups, not client_id (unless you have the numeric ID)
- Double-check data types: strings for text, numbers for IDs, booleans for flags
`;
  }
}

module.exports = AgenticOrchestrator;
