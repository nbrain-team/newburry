/**
 * FILE PROCESSOR SERVICE
 * Handles extraction and processing of various file types for AI Agent chat
 */

const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs').promises;
const path = require('path');
const { OpenAI } = require('openai');

class FileProcessor {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Process uploaded file and extract content
   */
  async processFile(filePath, fileType, originalName) {
    try {
      let result = {
        extracted_content: '',
        metadata: {},
        processing_status: 'completed',
        error_message: null,
      };

      // Read file buffer
      const fileBuffer = await fs.readFile(filePath);

      // Process based on file type
      if (fileType.startsWith('image/')) {
        result = await this.processImage(fileBuffer, originalName);
      } else if (fileType === 'application/pdf') {
        result = await this.processPDF(fileBuffer);
      } else if (
        fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        fileType === 'application/msword'
      ) {
        result = await this.processWord(fileBuffer);
      } else if (fileType.startsWith('text/') || originalName.match(/\.(txt|md|json|csv)$/i)) {
        result = await this.processText(fileBuffer, originalName);
      } else if (fileType.startsWith('audio/') || originalName.match(/\.(mp3|wav|m4a|ogg)$/i)) {
        result = await this.processAudio(filePath, originalName);
      } else if (fileType.startsWith('video/') || originalName.match(/\.(mp4|mov|avi|mkv)$/i)) {
        result = await this.processVideo(filePath, originalName);
      } else {
        result.processing_status = 'failed';
        result.error_message = 'Unsupported file type';
        result.extracted_content = `[Unsupported file type: ${fileType}]`;
      }

      return result;
    } catch (error) {
      console.error('[FileProcessor] Error processing file:', error);
      return {
        extracted_content: `[Error processing file: ${error.message}]`,
        metadata: {},
        processing_status: 'failed',
        error_message: error.message,
      };
    }
  }

  /**
   * Process image files (provide description, OCR if needed)
   */
  async processImage(buffer, fileName) {
    return {
      extracted_content: `[Image uploaded: ${fileName}]\n\nThis is a visual reference that the user can describe or ask questions about. The AI can analyze this image if needed.`,
      metadata: {
        type: 'image',
        size: buffer.length,
      },
      processing_status: 'completed',
    };
  }

  /**
   * Process PDF files
   */
  async processPDF(buffer) {
    try {
      // Handle both default and named exports
      const parse = pdfParse.default || pdfParse;
      const pdfData = await parse(buffer);
      const content = this.cleanText(pdfData.text);

      return {
        extracted_content: content,
        metadata: {
          type: 'pdf',
          pages: pdfData.numpages,
          info: pdfData.info,
        },
        processing_status: 'completed',
      };
    } catch (error) {
      throw new Error(`PDF parsing failed: ${error.message}`);
    }
  }

  /**
   * Process Word documents
   */
  async processWord(buffer) {
    try {
      const result = await mammoth.extractRawText({ buffer });
      const content = this.cleanText(result.value);

      return {
        extracted_content: content,
        metadata: {
          type: 'word',
        },
        processing_status: 'completed',
      };
    } catch (error) {
      throw new Error(`Word document parsing failed: ${error.message}`);
    }
  }

  /**
   * Process text files
   */
  async processText(buffer, fileName) {
    try {
      const content = buffer.toString('utf-8');
      const cleanedContent = this.cleanText(content);

      // Detect if it's JSON or CSV for special handling
      const isJSON = fileName.match(/\.json$/i);
      const isCSV = fileName.match(/\.csv$/i);

      let metadata = { type: 'text' };
      if (isJSON) {
        try {
          const jsonData = JSON.parse(content);
          metadata = {
            type: 'json',
            structure: this.analyzeJSONStructure(jsonData),
          };
        } catch (e) {
          // Not valid JSON, treat as text
        }
      } else if (isCSV) {
        metadata = {
          type: 'csv',
          rows: content.split('\n').length,
        };
      }

      return {
        extracted_content: cleanedContent,
        metadata,
        processing_status: 'completed',
      };
    } catch (error) {
      throw new Error(`Text file parsing failed: ${error.message}`);
    }
  }

  /**
   * Process audio files (transcription)
   */
  async processAudio(filePath, fileName) {
    try {
      // Check if OpenAI API is configured
      if (!process.env.OPENAI_API_KEY) {
        return {
          extracted_content: `[Audio file uploaded: ${fileName}]\n\nOpenAI API key not configured. Audio transcription is not available.`,
          metadata: { type: 'audio' },
          processing_status: 'completed',
        };
      }

      // Use OpenAI Whisper for transcription
      const transcription = await this.openai.audio.transcriptions.create({
        file: await fs.readFile(filePath),
        model: 'whisper-1',
        response_format: 'verbose_json',
      });

      const content = `[Audio Transcription: ${fileName}]\n\n${transcription.text}`;

      return {
        extracted_content: content,
        metadata: {
          type: 'audio',
          duration: transcription.duration,
          language: transcription.language,
        },
        processing_status: 'completed',
      };
    } catch (error) {
      console.error('[FileProcessor] Audio transcription error:', error);
      return {
        extracted_content: `[Audio file uploaded: ${fileName}]\n\nTranscription failed: ${error.message}`,
        metadata: { type: 'audio' },
        processing_status: 'failed',
        error_message: error.message,
      };
    }
  }

  /**
   * Process video files (extract audio and transcribe)
   */
  async processVideo(filePath, fileName) {
    // Video processing would require ffmpeg or similar tools
    // For now, we'll just provide a placeholder
    return {
      extracted_content: `[Video file uploaded: ${fileName}]\n\nVideo processing requires additional setup. The user can describe the video content or provide a transcript.`,
      metadata: {
        type: 'video',
      },
      processing_status: 'completed',
    };
  }

  /**
   * Clean and normalize text content
   */
  cleanText(text) {
    return text
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .trim();
  }

  /**
   * Analyze JSON structure for metadata
   */
  analyzeJSONStructure(data) {
    const type = Array.isArray(data) ? 'array' : typeof data;
    let structure = { type };

    if (Array.isArray(data)) {
      structure.length = data.length;
      if (data.length > 0) {
        structure.itemType = typeof data[0];
        if (typeof data[0] === 'object') {
          structure.keys = Object.keys(data[0]);
        }
      }
    } else if (typeof data === 'object' && data !== null) {
      structure.keys = Object.keys(data);
    }

    return structure;
  }

  /**
   * Generate summary of content using AI (optional enhancement)
   */
  async generateSummary(content, fileType) {
    try {
      if (!process.env.ANTHROPIC_API_KEY || content.length < 500) {
        return null;
      }

      // Truncate very long content
      const truncatedContent = content.substring(0, 10000);

      // Use Gemini to generate a brief summary
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
      const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

      const prompt = `Please provide a brief 2-3 sentence summary of this ${fileType} content:\n\n${truncatedContent}`;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error('[FileProcessor] Summary generation error:', error);
      return null;
    }
  }
}

module.exports = new FileProcessor();









