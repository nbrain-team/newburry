/**
 * Transcript Analysis JSON Validator
 * Ensures structured output from transcript analysis is complete and valid
 */

/**
 * Expected JSON schema for transcript analysis
 */
const TRANSCRIPT_ANALYSIS_SCHEMA = {
  action_items: {
    type: 'array',
    required: true,
    itemSchema: {
      item: { type: 'string', required: true },
      assigned_to: { type: 'string', required: true },
      deadline: { type: 'string', required: false },
      priority: { type: 'string', enum: ['high', 'medium', 'low'], required: true },
      context: { type: 'string', required: true },
      source_quote: { type: 'string', required: true },
      confidence: { type: 'number', min: 0, max: 1, required: true },
      category: { 
        type: 'string', 
        enum: ['explicit', 'implicit', 'question', 'document', 'access', 'introduction', 'review'],
        required: true 
      },
    },
  },
  questions_needing_answers: {
    type: 'array',
    required: true,
    itemSchema: {
      question: { type: 'string', required: true },
      asked_by: { type: 'string', required: true },
      directed_to: { type: 'string', required: false },
      context: { type: 'string', required: true },
      source_quote: { type: 'string', required: true },
    },
  },
  decisions_made: {
    type: 'array',
    required: true,
    itemSchema: {
      decision: { type: 'string', required: true },
      made_by: { type: 'string', required: true },
      implications: { type: 'string', required: true },
      source_quote: { type: 'string', required: true },
    },
  },
  key_topics_discussed: {
    type: 'array',
    required: true,
    itemSchema: {
      topic: { type: 'string', required: true },
      summary: { type: 'string', required: true },
      importance: { type: 'string', enum: ['high', 'medium', 'low'], required: true },
    },
  },
  next_meeting: {
    type: 'object',
    required: true,
    schema: {
      scheduled: { type: 'boolean', required: true },
      date: { type: 'string', required: false },
      purpose: { type: 'string', required: false },
    },
  },
  analysis_metadata: {
    type: 'object',
    required: true,
    schema: {
      total_action_items: { type: 'number', required: true },
      high_priority_items: { type: 'number', required: true },
      items_with_deadlines: { type: 'number', required: true },
      transcript_length: { type: 'string', required: false },
      analysis_thoroughness: { type: 'string', enum: ['complete', 'partial'], required: true },
      potential_missed_items: { type: 'string', required: false },
    },
  },
};

/**
 * Validate transcript analysis JSON structure
 */
function validateTranscriptAnalysis(data) {
  const errors = [];
  const warnings = [];

  if (!data || typeof data !== 'object') {
    return {
      valid: false,
      errors: ['Data is not an object'],
      warnings: [],
    };
  }

  // Validate top-level structure
  for (const [key, schema] of Object.entries(TRANSCRIPT_ANALYSIS_SCHEMA)) {
    if (schema.required && !(key in data)) {
      errors.push(`Missing required field: ${key}`);
      continue;
    }

    if (key in data) {
      const value = data[key];

      // Validate arrays
      if (schema.type === 'array') {
        if (!Array.isArray(value)) {
          errors.push(`Field ${key} must be an array`);
        } else {
          // Validate array items
          value.forEach((item, index) => {
            const itemErrors = validateItem(item, schema.itemSchema, `${key}[${index}]`);
            errors.push(...itemErrors);
          });
        }
      }

      // Validate objects
      if (schema.type === 'object') {
        if (typeof value !== 'object' || Array.isArray(value)) {
          errors.push(`Field ${key} must be an object`);
        } else {
          const itemErrors = validateItem(value, schema.schema, key);
          errors.push(...itemErrors);
        }
      }
    }
  }

  // Quality checks and warnings
  if (data.action_items && data.action_items.length === 0) {
    warnings.push('No action items found - this is unusual for most meetings');
  }

  if (data.action_items) {
    const lowConfidenceItems = data.action_items.filter(item => item.confidence < 0.7);
    if (lowConfidenceItems.length > 0) {
      warnings.push(`${lowConfidenceItems.length} action items have low confidence (<0.7)`);
    }

    const vagueitems = data.action_items.filter(item => 
      item.item.length < 20 || !item.source_quote || item.source_quote.length < 10
    );
    if (vagueitems.length > 0) {
      warnings.push(`${vagueitems.length} action items may be too vague or lack proper source quotes`);
    }
  }

  if (data.analysis_metadata && data.analysis_metadata.analysis_thoroughness === 'partial') {
    warnings.push('Analysis marked as partial - some items may have been missed');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate individual item against schema
 */
function validateItem(item, schema, path) {
  const errors = [];

  if (!item || typeof item !== 'object') {
    errors.push(`${path} is not an object`);
    return errors;
  }

  for (const [key, fieldSchema] of Object.entries(schema)) {
    if (fieldSchema.required && !(key in item)) {
      errors.push(`${path}.${key} is required but missing`);
      continue;
    }

    if (key in item) {
      const value = item[key];

      // Type validation
      if (fieldSchema.type === 'string' && typeof value !== 'string') {
        errors.push(`${path}.${key} must be a string`);
      }
      if (fieldSchema.type === 'number' && typeof value !== 'number') {
        errors.push(`${path}.${key} must be a number`);
      }
      if (fieldSchema.type === 'boolean' && typeof value !== 'boolean') {
        errors.push(`${path}.${key} must be a boolean`);
      }

      // Enum validation
      if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
        errors.push(`${path}.${key} must be one of: ${fieldSchema.enum.join(', ')}`);
      }

      // Range validation
      if (fieldSchema.type === 'number') {
        if (fieldSchema.min !== undefined && value < fieldSchema.min) {
          errors.push(`${path}.${key} must be >= ${fieldSchema.min}`);
        }
        if (fieldSchema.max !== undefined && value > fieldSchema.max) {
          errors.push(`${path}.${key} must be <= ${fieldSchema.max}`);
        }
      }
    }
  }

  return errors;
}

/**
 * Sanitize and fix common issues in transcript analysis data
 */
function sanitizeTranscriptAnalysis(data) {
  const sanitized = { ...data };

  // Ensure all required top-level fields exist
  if (!sanitized.action_items) sanitized.action_items = [];
  if (!sanitized.questions_needing_answers) sanitized.questions_needing_answers = [];
  if (!sanitized.decisions_made) sanitized.decisions_made = [];
  if (!sanitized.key_topics_discussed) sanitized.key_topics_discussed = [];
  if (!sanitized.next_meeting) sanitized.next_meeting = { scheduled: false };
  if (!sanitized.analysis_metadata) {
    sanitized.analysis_metadata = {
      total_action_items: sanitized.action_items.length,
      high_priority_items: 0,
      items_with_deadlines: 0,
      analysis_thoroughness: 'partial',
    };
  }

  // Sanitize action items
  sanitized.action_items = sanitized.action_items.map(item => ({
    item: item.item || 'Unknown action item',
    assigned_to: item.assigned_to || 'Unknown',
    deadline: item.deadline || 'No deadline mentioned',
    priority: ['high', 'medium', 'low'].includes(item.priority) ? item.priority : 'medium',
    context: item.context || 'No context provided',
    source_quote: item.source_quote || 'No source quote',
    confidence: typeof item.confidence === 'number' ? item.confidence : 0.5,
    category: ['explicit', 'implicit', 'question', 'document', 'access', 'introduction', 'review'].includes(item.category) 
      ? item.category 
      : 'explicit',
  }));

  // Update metadata
  sanitized.analysis_metadata.total_action_items = sanitized.action_items.length;
  sanitized.analysis_metadata.high_priority_items = sanitized.action_items.filter(i => i.priority === 'high').length;
  sanitized.analysis_metadata.items_with_deadlines = sanitized.action_items.filter(i => 
    i.deadline && i.deadline !== 'No deadline mentioned'
  ).length;

  return sanitized;
}

/**
 * Generate a human-readable validation report
 */
function generateValidationReport(validationResult) {
  let report = '';

  if (validationResult.valid) {
    report += '✅ Transcript analysis structure is valid\n\n';
  } else {
    report += '❌ Transcript analysis has validation errors:\n\n';
    validationResult.errors.forEach(error => {
      report += `  - ${error}\n`;
    });
    report += '\n';
  }

  if (validationResult.warnings.length > 0) {
    report += '⚠️  Warnings:\n\n';
    validationResult.warnings.forEach(warning => {
      report += `  - ${warning}\n`;
    });
  }

  return report;
}

module.exports = {
  TRANSCRIPT_ANALYSIS_SCHEMA,
  validateTranscriptAnalysis,
  sanitizeTranscriptAnalysis,
  generateValidationReport,
};


