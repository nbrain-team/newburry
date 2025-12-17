// ============================================================================
// Tool: Deep Transcript Analysis (Multi-Pass)
// Performs thorough, multi-pass analysis of meeting transcripts
// ============================================================================

const { GoogleGenerativeAI } = require('@google/generative-ai');
let Anthropic;
try {
  Anthropic = require('@anthropic-ai/sdk');
} catch (error) {
  console.warn('[DeepTranscriptAnalysis] Anthropic SDK not available - will use Gemini only');
}
const clientConfig = require('../config/client-config');
const { validateTranscriptAnalysis, sanitizeTranscriptAnalysis, generateValidationReport } = require('../utils/transcriptAnalysisValidator');

module.exports = {
  name: 'analyze_transcript_deeply',
  description: `Performs DEEP, multi-pass analysis of meeting transcripts to extract ALL action items, commitments, questions, and decisions. 
  
  Use this tool when:
  - User asks to "analyze the transcript" or "extract action items"
  - User wants comprehensive meeting analysis
  - User mentions they need ALL follow-up items
  - Standard transcript search isn't thorough enough
  
  This tool makes multiple AI passes to ensure nothing is missed:
  - Pass 1: Extract explicit action items
  - Pass 2: Extract implicit commitments and questions
  - Pass 3: Identify decisions and key topics
  - Pass 4: Verification pass to catch missed items
  
  Returns structured JSON with complete action item breakdown.`,
  
  parameters: {
    type: 'object',
    properties: {
      transcript_id: {
        type: 'integer',
        description: 'ID of the transcript to analyze (from search_transcripts result)',
      },
      transcript_text: {
        type: 'string',
        description: 'Full transcript text to analyze (if you already have it)',
      },
      focus_areas: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: Specific areas to focus on (e.g., ["action_items", "questions", "decisions"])',
      },
      use_claude: {
        type: 'boolean',
        description: 'Use Claude Opus instead of Gemini for more thorough analysis (default: true)',
        default: true,
      },
    },
    required: [],
  },
  
  async execute({ transcript_id, transcript_text, focus_areas = [], use_claude = true }, { dbPool, userId }) {
    try {
      let transcriptData = null;
      
      // If transcript_id provided, fetch from database
      if (transcript_id) {
        const result = await dbPool.query(
          `SELECT id, title, transcript_text, summary, action_items, key_questions, 
                  topics, participants, scheduled_at, client_id
           FROM meeting_transcripts 
           WHERE id = $1`,
          [transcript_id]
        );
        
        if (result.rowCount === 0) {
          return {
            success: false,
            error: 'Transcript not found',
            data: null,
          };
        }
        
        transcriptData = result.rows[0];
        transcript_text = transcriptData.transcript_text;
      }
      
      if (!transcript_text || transcript_text.trim().length === 0) {
        return {
          success: false,
          error: 'No transcript text provided',
          data: null,
        };
      }
      
      console.log(`[DeepTranscriptAnalysis] Starting multi-pass analysis (${transcript_text.length} chars)`);
      console.log(`[DeepTranscriptAnalysis] Using model: ${use_claude ? 'Claude Opus' : 'Gemini Pro'}`);
      
      // Get the specialized transcript analysis prompt
      const systemPrompt = clientConfig.getSystemPrompt('transcript_analyzer');
      
      // PASS 1: Extract explicit action items
      console.log('[DeepTranscriptAnalysis] Pass 1: Extracting explicit action items...');
      const pass1Result = await analyzeWithAI(
        transcript_text,
        systemPrompt,
        'Extract ALL explicit action items and commitments. Focus on phrases like "I will", "I\'ll send", "Let me", etc.',
        use_claude
      );
      
      // PASS 2: Extract implicit commitments and questions
      console.log('[DeepTranscriptAnalysis] Pass 2: Extracting implicit commitments and questions...');
      const pass2Result = await analyzeWithAI(
        transcript_text,
        systemPrompt,
        'Extract ALL implicit commitments, questions that need answers, and any follow-up items that weren\'t explicitly stated as action items.',
        use_claude
      );
      
      // PASS 3: Identify decisions and key topics
      console.log('[DeepTranscriptAnalysis] Pass 3: Identifying decisions and key topics...');
      const pass3Result = await analyzeWithAI(
        transcript_text,
        systemPrompt,
        'Extract ALL decisions made, key topics discussed, and any next steps or future meetings mentioned.',
        use_claude
      );
      
      // PASS 4: Verification pass
      console.log('[DeepTranscriptAnalysis] Pass 4: Verification pass to catch missed items...');
      const combinedResults = {
        pass1: pass1Result,
        pass2: pass2Result,
        pass3: pass3Result,
      };
      
      const pass4Result = await analyzeWithAI(
        transcript_text,
        systemPrompt,
        `Review the transcript one more time. Here's what was found in previous passes:\n\n${JSON.stringify(combinedResults, null, 2)}\n\nDid we miss ANY action items, commitments, questions, or follow-ups? Extract anything that was missed.`,
        use_claude
      );
      
      // Combine and deduplicate all results
      console.log('[DeepTranscriptAnalysis] Combining and deduplicating results...');
      let finalAnalysis = combineAndDeduplicate([pass1Result, pass2Result, pass3Result, pass4Result]);
      
      // Add metadata
      finalAnalysis.analysis_metadata = {
        ...finalAnalysis.analysis_metadata,
        transcript_id: transcript_id || null,
        transcript_length_chars: transcript_text.length,
        transcript_length_words: transcript_text.split(/\s+/).length,
        analysis_passes: 4,
        model_used: use_claude ? 'Claude Opus' : 'Gemini Pro',
        analyzed_at: new Date().toISOString(),
      };
      
      // VALIDATE the structured output
      console.log('[DeepTranscriptAnalysis] Validating structured output...');
      const validationResult = validateTranscriptAnalysis(finalAnalysis);
      
      if (!validationResult.valid) {
        console.warn('[DeepTranscriptAnalysis] Validation errors found:', validationResult.errors);
        console.log('[DeepTranscriptAnalysis] Sanitizing data to fix issues...');
        finalAnalysis = sanitizeTranscriptAnalysis(finalAnalysis);
        
        // Re-validate after sanitization
        const revalidation = validateTranscriptAnalysis(finalAnalysis);
        if (!revalidation.valid) {
          console.error('[DeepTranscriptAnalysis] Still has validation errors after sanitization:', revalidation.errors);
        }
      }
      
      if (validationResult.warnings.length > 0) {
        console.warn('[DeepTranscriptAnalysis] Validation warnings:', validationResult.warnings);
      }
      
      // Add validation report to metadata
      finalAnalysis.analysis_metadata.validation_report = generateValidationReport(validationResult);
      finalAnalysis.analysis_metadata.validation_status = validationResult.valid ? 'valid' : 'sanitized';
      
      // If we have transcript_id, update the database with enhanced analysis
      if (transcript_id && transcriptData) {
        await dbPool.query(
          `UPDATE meeting_transcripts 
           SET action_items = $1, 
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify(finalAnalysis.action_items), transcript_id]
        );
        console.log(`[DeepTranscriptAnalysis] Updated transcript ${transcript_id} with enhanced action items`);
      }
      
      return {
        success: true,
        data: finalAnalysis,
        source_type: 'deep_transcript_analysis',
        confidence: 0.95,
        data_points: [
          `Analyzed ${finalAnalysis.analysis_metadata.transcript_length_words} words`,
          `Found ${finalAnalysis.action_items.length} action items`,
          `Found ${finalAnalysis.questions_needing_answers.length} questions`,
          `Found ${finalAnalysis.decisions_made.length} decisions`,
          `Used ${finalAnalysis.analysis_metadata.analysis_passes} analysis passes`,
          `Validation: ${finalAnalysis.analysis_metadata.validation_status}`,
        ],
      };
      
    } catch (error) {
      console.error('[DeepTranscriptAnalysis] Error:', error);
      return {
        success: false,
        error: error.message,
        data: null,
      };
    }
  }
};

/**
 * Analyze transcript with AI (Claude or Gemini)
 */
async function analyzeWithAI(transcriptText, systemPrompt, specificInstructions, useClaude = true) {
  const fullPrompt = `${specificInstructions}

TRANSCRIPT TO ANALYZE:
${transcriptText}

Return your analysis in the exact JSON format specified in the system prompt. Be thorough and precise.`;

  try {
    if (useClaude && Anthropic && process.env.ANTHROPIC_API_KEY) {
      // Use Claude Opus for maximum thoroughness
      const anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-20250514',
        max_tokens: 8000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: fullPrompt,
          },
        ],
      });
      
      const responseText = response.content[0].text;
      return parseAIResponse(responseText);
      
    } else {
      // Fallback to Gemini
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({
        model: 'gemini-3-pro-preview',
        systemInstruction: systemPrompt,
      });
      
      const result = await model.generateContent(fullPrompt);
      const responseText = result.response.text();
      return parseAIResponse(responseText);
    }
  } catch (error) {
    console.error('[DeepTranscriptAnalysis] AI analysis error:', error);
    throw error;
  }
}

/**
 * Parse AI response and extract JSON
 */
function parseAIResponse(responseText) {
  try {
    // Try to extract JSON from response (handle markdown code blocks)
    let jsonText = responseText;
    
    // Remove markdown code blocks if present
    const jsonMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Ensure required structure exists
    return {
      action_items: parsed.action_items || [],
      questions_needing_answers: parsed.questions_needing_answers || [],
      decisions_made: parsed.decisions_made || [],
      key_topics_discussed: parsed.key_topics_discussed || [],
      next_meeting: parsed.next_meeting || { scheduled: false },
      analysis_metadata: parsed.analysis_metadata || {},
    };
  } catch (error) {
    console.error('[DeepTranscriptAnalysis] Failed to parse AI response:', error);
    console.error('Response text:', responseText.substring(0, 500));
    
    // Return empty structure if parsing fails
    return {
      action_items: [],
      questions_needing_answers: [],
      decisions_made: [],
      key_topics_discussed: [],
      next_meeting: { scheduled: false },
      analysis_metadata: {
        parse_error: error.message,
      },
    };
  }
}

/**
 * Combine and deduplicate results from multiple passes
 */
function combineAndDeduplicate(results) {
  const combined = {
    action_items: [],
    questions_needing_answers: [],
    decisions_made: [],
    key_topics_discussed: [],
    next_meeting: { scheduled: false },
    analysis_metadata: {},
  };
  
  // Combine action items and deduplicate
  const actionItemsMap = new Map();
  results.forEach(result => {
    (result.action_items || []).forEach(item => {
      const key = `${item.assigned_to}:${item.item}`.toLowerCase();
      if (!actionItemsMap.has(key)) {
        actionItemsMap.set(key, item);
      } else {
        // If duplicate, keep the one with higher confidence
        const existing = actionItemsMap.get(key);
        if (item.confidence > existing.confidence) {
          actionItemsMap.set(key, item);
        }
      }
    });
  });
  combined.action_items = Array.from(actionItemsMap.values());
  
  // Combine questions and deduplicate
  const questionsMap = new Map();
  results.forEach(result => {
    (result.questions_needing_answers || []).forEach(q => {
      const key = q.question.toLowerCase();
      if (!questionsMap.has(key)) {
        questionsMap.set(key, q);
      }
    });
  });
  combined.questions_needing_answers = Array.from(questionsMap.values());
  
  // Combine decisions and deduplicate
  const decisionsMap = new Map();
  results.forEach(result => {
    (result.decisions_made || []).forEach(d => {
      const key = d.decision.toLowerCase();
      if (!decisionsMap.has(key)) {
        decisionsMap.set(key, d);
      }
    });
  });
  combined.decisions_made = Array.from(decisionsMap.values());
  
  // Combine key topics
  const topicsMap = new Map();
  results.forEach(result => {
    (result.key_topics_discussed || []).forEach(t => {
      const key = t.topic.toLowerCase();
      if (!topicsMap.has(key)) {
        topicsMap.set(key, t);
      }
    });
  });
  combined.key_topics_discussed = Array.from(topicsMap.values());
  
  // Take next_meeting from any result that has it
  results.forEach(result => {
    if (result.next_meeting && result.next_meeting.scheduled) {
      combined.next_meeting = result.next_meeting;
    }
  });
  
  // Combine metadata
  combined.analysis_metadata = {
    total_action_items: combined.action_items.length,
    high_priority_items: combined.action_items.filter(i => i.priority === 'high').length,
    items_with_deadlines: combined.action_items.filter(i => i.deadline && i.deadline !== 'No deadline mentioned').length,
    total_questions: combined.questions_needing_answers.length,
    total_decisions: combined.decisions_made.length,
    analysis_thoroughness: 'complete',
  };
  
  return combined;
}

