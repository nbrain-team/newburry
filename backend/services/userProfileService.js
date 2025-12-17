/**
 * User Profile Service
 * 
 * Helper functions for loading and managing user personalization profiles
 * Used by the orchestrator to inject user context into AI interactions
 */

class UserProfileService {
  constructor(dbPool) {
    this.dbPool = dbPool;
  }

  /**
   * Get complete user personalization profile
   */
  async getUserProfile(userId) {
    console.log(`[UserProfileService] Loading profile for user ${userId}`);
    
    try {
      const result = await this.dbPool.query(`
        SELECT 
          up.full_name,
          up.job_title,
          up.email_signature,
          up.phone_number,
          up.common_signoffs,
          up.tone_preference,
          up.writing_patterns,
          up.last_analyzed_at,
          up.analyzed_email_count,
          up.use_personalization,
          u.email,
          u.name
        FROM agent_user_preferences up
        JOIN users u ON up.user_id = u.id
        WHERE up.user_id = $1
        LIMIT 1
      `, [userId]);
    } catch (error) {
      // If columns don't exist yet (migration not run), return default
      console.warn('[UserProfileService] Profile query failed, returning defaults:', error.message);
      return this.getDefaultProfile(userId);
    }

    if (result.rowCount === 0) {
      console.warn(`[UserProfileService] No profile found for user ${userId}, using defaults`);
      return this.getDefaultProfile(userId);
    }

    const profile = result.rows[0];
    console.log(`[UserProfileService] ✅ Profile loaded for ${profile.full_name || profile.name} (user ${userId})`);

    // Get custom preferences (like meeting_scheduling_preference)
    let customPreferences = {};
    try {
      const prefsResult = await this.dbPool.query(`
        SELECT preference_key, preference_value
        FROM agent_user_preferences
        WHERE user_id = $1 
          AND preference_key IN ('meeting_scheduling_preference', 'calendly_link')
          AND preference_value IS NOT NULL
      `, [userId]);
      
      if (prefsResult && prefsResult.rows) {
        prefsResult.rows.forEach(row => {
          customPreferences[row.preference_key] = row.preference_value;
        });
      }
    } catch (error) {
      console.warn('[UserProfileService] Could not fetch custom preferences:', error.message);
      // Continue without custom preferences
      customPreferences = {};
    }

    return {
      user_id: userId,
      full_name: profile.full_name || profile.name,
      job_title: profile.job_title,
      email: profile.email,
      email_signature: profile.email_signature,
      phone_number: profile.phone_number,
      common_signoffs: profile.common_signoffs || [],
      tone_preference: profile.tone_preference || 'professional',
      writing_patterns: profile.writing_patterns || {},
      last_analyzed_at: profile.last_analyzed_at,
      analyzed_email_count: profile.analyzed_email_count || 0,
      use_personalization: profile.use_personalization !== false,
      has_profile: !!profile.last_analyzed_at,
      custom_preferences: customPreferences,
    };
  }

  /**
   * Get default profile for users not yet analyzed
   */
  async getDefaultProfile(userId) {
    const result = await this.dbPool.query(`
      SELECT name, email FROM users WHERE id = $1
    `, [userId]);

    if (result.rowCount === 0) {
      throw new Error(`User ${userId} not found`);
    }

    const user = result.rows[0];

    // Create a basic professional signature from user data
    const defaultSignature = `Best regards,\n${user.name}\nnBrain AI\n${user.email}`;

    return {
      user_id: userId,
      full_name: user.name,
      job_title: null,
      email: user.email,
      email_signature: defaultSignature,  // Provide default instead of null
      phone_number: null,
      common_signoffs: ['Best regards', 'Thanks', 'Sincerely'],
      tone_preference: 'professional',
      writing_patterns: {},
      last_analyzed_at: null,
      analyzed_email_count: 0,
      use_personalization: false,
      has_profile: false,
    };
  }

  /**
   * Get user's email style examples for context
   */
  async getUserStyleExamples(userId, contextType = null, limit = 3) {
    let query = `
      SELECT 
        context_type,
        subject,
        body_excerpt,
        full_body,
        tone,
        email_date
      FROM user_email_style_examples
      WHERE user_id = $1
    `;

    const params = [userId];

    if (contextType) {
      query += ` AND context_type = $2`;
      params.push(contextType);
    }

    query += ` ORDER BY email_date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await this.dbPool.query(query, params);
    return result.rows;
  }

  /**
   * Format user profile for AI system prompt injection
   */
  formatForPrompt(profile) {
    if (!profile || !profile.use_personalization) {
      console.warn('[UserProfileService] Personalization disabled or no profile');
      return ''; // No personalization if disabled or not analyzed
    }

    console.log(`[UserProfileService] Formatting prompt for ${profile.full_name}`);

    let prompt = `\n\n═══ USER PERSONALIZATION ═══\n`;
    prompt += `You are writing as: ${profile.full_name || 'the user'}\n`;
    prompt += `⚠️ CRITICAL: You must use this EXACT name in signatures, do NOT use any other name!\n`;

    if (profile.job_title) {
      prompt += `Title: ${profile.job_title}\n`;
    }

    if (profile.email_signature) {
      prompt += `\nEmail Signature (use this EXACT signature, no placeholders, no changes, no substitutions):\n`;
      prompt += `${profile.email_signature}\n`;
      prompt += `⚠️ DO NOT use any other name, phone, or email - ONLY use what is shown above!\n`;
    }

    if (profile.tone_preference) {
      prompt += `\nPreferred Tone: ${profile.tone_preference}\n`;
    }

    if (profile.common_signoffs && profile.common_signoffs.length > 0) {
      prompt += `Common sign-offs: ${profile.common_signoffs.join(', ')}\n`;
    }

    if (profile.writing_patterns) {
      const patterns = profile.writing_patterns;
      prompt += `\nWriting Style:\n`;
      
      if (patterns.avg_sentence_length) {
        prompt += `- Average sentence length: ${patterns.avg_sentence_length} words\n`;
      }
      
      if (patterns.uses_contractions !== undefined) {
        prompt += `- Uses contractions: ${patterns.uses_contractions ? 'Yes' : 'No'}\n`;
      }
      
      if (patterns.email_length_preference) {
        prompt += `- Typical email length: ${patterns.email_length_preference}\n`;
      }
      
      if (patterns.common_phrases && patterns.common_phrases.length > 0) {
        prompt += `- Common phrases: ${patterns.common_phrases.slice(0, 3).join(', ')}\n`;
      }
    }

    // Add custom preferences (like meeting scheduling)
    if (profile.custom_preferences) {
      if (profile.custom_preferences.meeting_scheduling_preference) {
        prompt += `\nMeeting Scheduling Preference:\n`;
        prompt += `${profile.custom_preferences.meeting_scheduling_preference}\n`;
      }
    }

    prompt += `\n🚨 ABSOLUTELY CRITICAL RULES:\n`;
    prompt += `1. You ARE ${profile.full_name} - do NOT use any other name!\n`;
    prompt += `2. Use the EXACT signature shown above - do NOT modify, substitute, or create a new one!\n`;
    prompt += `3. Do NOT hallucinate names like "Jim Keplinger", "Cary Smith" or any other fake names!\n`;
    prompt += `4. Write in ${profile.full_name}'s voice and style shown above.\n`;
    prompt += `5. If no signature is provided above, use: "${profile.full_name}"\n`;
    prompt += `═══════════════════════════════\n\n`;

    return prompt;
  }

  /**
   * Format style examples for prompt
   */
  formatExamplesForPrompt(examples) {
    if (!examples || examples.length === 0) {
      return '';
    }

    let prompt = `\n\n═══ WRITING STYLE EXAMPLES ═══\n`;
    prompt += `Here are examples of how this user typically writes:\n\n`;

    examples.forEach((example, index) => {
      prompt += `Example ${index + 1} (${example.context_type}):\n`;
      prompt += `Subject: ${example.subject}\n`;
      prompt += `${example.body_excerpt}\n`;
      prompt += `---\n\n`;
    });

    prompt += `Match the tone, style, and structure shown in these examples.\n`;
    prompt += `═══════════════════════════════\n\n`;

    return prompt;
  }

  /**
   * Check if user needs style analysis
   */
  async needsAnalysis(userId) {
    const result = await this.dbPool.query(`
      SELECT 
        last_analyzed_at,
        analyzed_email_count,
        auto_analyze
      FROM agent_user_preferences
      WHERE user_id = $1
    `, [userId]);

    if (result.rowCount === 0) {
      return true; // New user, needs analysis
    }

    const pref = result.rows[0];

    // Needs analysis if:
    // 1. Never analyzed
    // 2. Auto-analyze enabled and analyzed > 7 days ago
    // 3. Has very few emails analyzed
    
    if (!pref.last_analyzed_at) return true;
    if (pref.analyzed_email_count < 5) return true;
    
    if (pref.auto_analyze) {
      const daysSinceAnalysis = (Date.now() - new Date(pref.last_analyzed_at)) / (1000 * 60 * 60 * 24);
      if (daysSinceAnalysis > 7) return true;
    }

    return false;
  }

  /**
   * Get analysis status for user
   */
  async getAnalysisStatus(userId) {
    const result = await this.dbPool.query(`
      SELECT 
        up.last_analyzed_at,
        up.analyzed_email_count,
        up.use_personalization,
        up.auto_analyze,
        COUNT(e.id) as total_sent_emails,
        MAX(e.date) as latest_email_date
      FROM agent_user_preferences up
      LEFT JOIN synced_emails e ON e.user_id = up.user_id AND e.is_sent = true
      WHERE up.user_id = $1
      GROUP BY up.user_id, up.last_analyzed_at, up.analyzed_email_count, 
               up.use_personalization, up.auto_analyze
    `, [userId]);

    if (result.rowCount === 0) {
      return {
        has_profile: false,
        needs_analysis: true,
        total_sent_emails: 0,
      };
    }

    const status = result.rows[0];

    return {
      has_profile: !!status.last_analyzed_at,
      last_analyzed_at: status.last_analyzed_at,
      analyzed_email_count: status.analyzed_email_count || 0,
      total_sent_emails: parseInt(status.total_sent_emails) || 0,
      latest_email_date: status.latest_email_date,
      use_personalization: status.use_personalization,
      auto_analyze: status.auto_analyze,
      needs_analysis: await this.needsAnalysis(userId),
    };
  }
}

module.exports = UserProfileService;

