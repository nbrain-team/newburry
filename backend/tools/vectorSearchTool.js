/**
 * Vector Search Tool - Pinecone Integration
 * 
 * Performs semantic search across the knowledge base stored in Pinecone.
 * Used for finding relevant proposals, methodologies, past work, etc.
 */

const { Pinecone } = require('@pinecone-database/pinecone');
const { OpenAI } = require('openai');

// Initialize clients (singleton pattern)
let pineconeClient = null;
let openaiClient = null;

function getPineconeClient() {
  if (!pineconeClient) {
    pineconeClient = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
      // environment parameter removed - no longer needed in v3+
    });
  }
  return pineconeClient;
}

function getOpenAIClient() {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

module.exports = {
  name: 'vector_search',
  description: 'OPTIONAL: Semantic search across the knowledge base (proposals, methodologies, past projects, best practices). If unavailable, other tools can still complete the task. Returns relevant content with similarity scores.',
  category: 'knowledge',
  requiresApproval: false,
  
  parameters: {
    query: {
      type: 'string',
      required: true,
      description: 'Search query (natural language)',
    },
    top_k: {
      type: 'number',
      required: false,
      description: 'Number of results to return (default: 10)',
    },
    min_similarity: {
      type: 'number',
      required: false,
      description: 'Minimum similarity score 0-1 (default: 0.7)',
    },
    filter: {
      type: 'object',
      required: false,
      description: 'Metadata filters (e.g., { source_type: "data_upload", tags: "proposal,sales" } or { source_type: "proposal", client_id: 5 }). For client uploads: use source_type="data_upload" and optionally tags="tag1,tag2"',
    },
  },

  async execute(params, context) {
    const {
      query,
      top_k = 10,
      min_similarity = 0.7,
      filter = {},
    } = params;
    const { userId, clientId } = context;

    try {
      // Step 1: Create embedding from query (768 dimensions to match Pinecone index)
      const openai = getOpenAIClient();
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        dimensions: 768, // Match Pinecone index dimensions
        input: query,
      });
      const embedding = embeddingResponse.data[0].embedding;

      // Step 2: Search Pinecone
      const pinecone = getPineconeClient();
      const indexName = process.env.PINECONE_INDEX_NAME;
      const index = pinecone.Index(indexName);

      // Use only explicit filters - no automatic clientId filtering
      const queryFilter = { ...filter };
      // REMOVED: automatic clientId filtering - all users see all knowledge

      const searchResults = await index.query({
        vector: embedding,
        topK: top_k,
        includeMetadata: true,
        filter: Object.keys(queryFilter).length > 0 ? queryFilter : undefined,
      });

      // Step 3: Filter by minimum similarity
      const filteredResults = searchResults.matches.filter(
        match => match.score >= min_similarity
      );

      // Step 4: Format results
      const formattedResults = filteredResults.map(match => ({
        id: match.id,
        score: match.score,
        content: match.metadata?.content || '',
        source_type: match.metadata?.source_type || 'unknown',
        source_id: match.metadata?.source_id,
        title: match.metadata?.title || 'Untitled',
        summary: match.metadata?.summary || '',
        created_at: match.metadata?.created_at,
      }));

      // Calculate average confidence
      const calculateConfidence = (results) => {
        if (results.length === 0) return 0;
        const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
        return Math.min(0.5 + (avgScore * 0.4), 0.9);
      };

      return {
        success: true,
        data: {
          results: formattedResults,
          count: formattedResults.length,
          query: query,
        },
        confidence: calculateConfidence(formattedResults),
        source_type: 'vector_search',
        data_points: formattedResults.map(r => ({
          title: r.title,
          source: r.source_type,
          relevance: r.score,
        })),
      };

    } catch (error) {
      console.error('[VectorSearchTool] Error:', error);
      console.error('[VectorSearchTool] Error details:', error.stack);
      
      // Return success with empty results instead of failure
      // This prevents breaking email generation workflow
      return {
        success: true,  // Changed to true - don't break workflow
        data: {
          results: [],
          count: 0,
          query: query,
        },
        message: 'Knowledge base search unavailable - continuing without it',
        warning: error.message,
        confidence: 0,
        source_type: 'vector_search',
        data_points: [],
      };
    }
  },

  /**
   * Create embedding from text using OpenAI
   */
  async createEmbedding(text) {
    const openai = getOpenAIClient();
    
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',  // MUST match transcriptIndexer model
      dimensions: 768, // Match Pinecone index dimensions
      input: text,
    });

    return response.data[0].embedding;
  },

  /**
   * Calculate average confidence from similarity scores
   */
  calculateAverageConfidence(results) {
    if (results.length === 0) return 0;
    
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    
    // Scale similarity score (0-1) to confidence (0.5-0.9)
    // High similarity = high confidence, but cap at 0.9 since it's not database-level certainty
    return Math.min(0.5 + (avgScore * 0.4), 0.9);
  },

  /**
   * Helper: Upsert content to Pinecone (for seeding)
   */
  async upsertContent({ id, content, metadata = {} }) {
    try {
      const openai = getOpenAIClient();
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        dimensions: 768, // Match Pinecone index dimensions
        input: content,
      });
      const embedding = embeddingResponse.data[0].embedding;
      
      const pinecone = getPineconeClient();
      const indexName = process.env.PINECONE_INDEX_NAME;
      const index = pinecone.Index(indexName);

      await index.upsert([{
        id,
        values: embedding,
        metadata: {
          ...metadata,
          content: content.substring(0, 40000), // Pinecone metadata limit
        },
      }]);

      return { success: true, id };
    } catch (error) {
      console.error('[VectorSearchTool] Upsert error:', error);
      return { success: false, error: error.message };
    }
  },
};

