/**
 * Document AI Intelligence Service - MVP Implementation
 * Provides basic but effective AI-powered document understanding
 */

export class DocumentIntelligenceService {
  constructor() {
    // Simple but effective categorization rules
    this.categories = {
      'financial': {
        keywords: ['invoice', 'receipt', 'budget', 'expense', 'payment', 'cost', 'revenue', 'profit'],
        patterns: [/\$[\d,]+\.?\d*/, /USD|EUR|GBP/, /invoice #?\d+/i],
        weight: 0.9
      },
      'legal': {
        keywords: ['contract', 'agreement', 'terms', 'legal', 'compliance', 'clause', 'liability'],
        patterns: [/article \d+/i, /section \d+/i, /whereas/i, /therefore/i],
        weight: 0.85
      },
      'technical': {
        keywords: ['API', 'function', 'code', 'development', 'specification', 'documentation'],
        patterns: [/function\s+\w+/, /class\s+\w+/, /API|endpoint/i, /version \d+\.\d+/],
        weight: 0.8
      },
      'product': {
        keywords: ['product', 'feature', 'requirement', 'specification', 'roadmap', 'launch'],
        patterns: [/feature \w+/i, /requirement \d+/i, /milestone/i],
        weight: 0.75
      },
      'marketing': {
        keywords: ['campaign', 'marketing', 'brand', 'promotion', 'advertising', 'social'],
        patterns: [/campaign \w+/i, /ROI/i, /conversion/i, /engagement/i],
        weight: 0.7
      }
    };
  }

  /**
   * Analyze uploaded document and extract intelligence
   */
  async analyzeDocument(file, extractedText = null) {
    const analysis = {
      filename: file.name,
      size: file.size,
      type: file.type,
      timestamp: new Date().toISOString(),
      confidence: 0
    };

    try {
      // Extract text if not provided
      if (!extractedText) {
        extractedText = await this.extractText(file);
      }

      // Perform analysis
      analysis.textContent = extractedText;
      analysis.language = this.detectLanguage(extractedText);
      analysis.category = this.categorizeContent(extractedText);
      analysis.entities = this.extractEntities(extractedText);
      analysis.keyPhrases = this.extractKeyPhrases(extractedText);
      analysis.summary = this.generateSummary(extractedText);
      analysis.tags = this.generateTags(extractedText, analysis.category);

      return analysis;
    } catch (error) {
      console.error('Document analysis failed:', error);
      return { ...analysis, error: error.message };
    }
  }

  /**
   * Extract text from various file types
   */
  async extractText(file) {
    const fileType = file.type;
    
    if (fileType === 'application/pdf') {
      return await this.extractFromPDF(file);
    } else if (fileType.startsWith('image/')) {
      return await this.extractFromImage(file);
    } else if (fileType.includes('word') || fileType.includes('document')) {
      return await this.extractFromOfficeDoc(file);
    } else if (fileType.startsWith('text/')) {
      return await this.extractFromText(file);
    } else {
      return ''; // Unknown format
    }
  }

  /**
   * Extract text from PDF using PDF.js (client-side)
   */
  async extractFromPDF(file) {
    try {
      // This would require PDF.js library in production
      // For now, return placeholder
      return `[PDF content extraction would happen here for: ${file.name}]`;
    } catch (error) {
      console.error('PDF extraction failed:', error);
      return '';
    }
  }

  /**
   * Extract text from images using OCR
   */
  async extractFromImage(file) {
    try {
      // This would require Tesseract.js in production
      // For now, return placeholder
      return `[Image OCR would happen here for: ${file.name}]`;
    } catch (error) {
      console.error('Image OCR failed:', error);
      return '';
    }
  }

  /**
   * Extract text from Office documents
   */
  async extractFromOfficeDoc(file) {
    try {
      // This would require mammoth.js or similar library
      // For now, return placeholder
      return `[Office document extraction would happen here for: ${file.name}]`;
    } catch (error) {
      console.error('Office doc extraction failed:', error);
      return '';
    }
  }

  /**
   * Extract text from plain text files
   */
  async extractFromText(file) {
    try {
      return await file.text();
    } catch (error) {
      console.error('Text extraction failed:', error);
      return '';
    }
  }

  /**
   * Categorize content using keyword and pattern matching
   */
  categorizeContent(text) {
    if (!text || text.length < 10) {
      return { category: 'general', confidence: 0.1 };
    }

    const textLower = text.toLowerCase();
    const scores = {};

    // Score each category
    for (const [category, rules] of Object.entries(this.categories)) {
      let score = 0;

      // Keyword matching
      for (const keyword of rules.keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex) || [];
        score += matches.length * 0.1;
      }

      // Pattern matching
      for (const pattern of rules.patterns) {
        const matches = text.match(pattern) || [];
        score += matches.length * 0.2;
      }

      scores[category] = score * rules.weight;
    }

    // Find best category
    const bestCategory = Object.keys(scores).reduce((a, b) => 
      scores[a] > scores[b] ? a : b
    );

    const confidence = Math.min(scores[bestCategory] / 2, 0.9);

    return {
      category: confidence > 0.3 ? bestCategory : 'general',
      confidence: confidence,
      allScores: scores
    };
  }

  /**
   * Detect document language (basic implementation)
   */
  detectLanguage(text) {
    if (!text) return 'unknown';

    // Simple language detection based on common words
    const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
    const frenchWords = ['le', 'la', 'les', 'et', 'ou', 'mais', 'dans', 'sur', 'pour', 'de', 'avec', 'par'];
    const spanishWords = ['el', 'la', 'los', 'las', 'y', 'o', 'pero', 'en', 'sobre', 'para', 'de', 'con', 'por'];

    const textLower = text.toLowerCase();
    
    const englishScore = englishWords.reduce((score, word) => 
      score + (textLower.split(word).length - 1), 0);
    const frenchScore = frenchWords.reduce((score, word) => 
      score + (textLower.split(word).length - 1), 0);
    const spanishScore = spanishWords.reduce((score, word) => 
      score + (textLower.split(word).length - 1), 0);

    if (englishScore > frenchScore && englishScore > spanishScore) return 'en';
    if (frenchScore > spanishScore) return 'fr';
    if (spanishScore > 0) return 'es';
    
    return 'unknown';
  }

  /**
   * Extract entities (dates, emails, phone numbers, etc.)
   */
  extractEntities(text) {
    if (!text) return {};

    const entities = {
      emails: text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g) || [],
      phones: text.match(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g) || [],
      dates: text.match(/\b\d{1,2}\/\d{1,2}\/\d{4}\b|\b\d{4}-\d{2}-\d{2}\b/g) || [],
      currencies: text.match(/\$[\d,]+\.?\d*/g) || [],
      urls: text.match(/https?:\/\/[^\s]+/g) || []
    };

    return entities;
  }

  /**
   * Extract key phrases using simple frequency analysis
   */
  extractKeyPhrases(text) {
    if (!text || text.length < 50) return [];

    // Simple implementation: find frequent meaningful words
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3)
      .filter(word => !this.isStopWord(word));

    const frequency = {};
    words.forEach(word => {
      frequency[word] = (frequency[word] || 0) + 1;
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  /**
   * Generate a simple summary
   */
  generateSummary(text) {
    if (!text || text.length < 100) return text;

    // Simple implementation: take first and last sentences
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
    
    if (sentences.length <= 2) return text;
    
    return sentences[0].trim() + '... ' + sentences[sentences.length - 1].trim();
  }

  /**
   * Generate relevant tags
   */
  generateTags(text, categoryAnalysis) {
    const tags = [];
    
    // Add category as primary tag
    if (categoryAnalysis.category !== 'general') {
      tags.push(categoryAnalysis.category);
    }

    // Add entity-based tags
    const entities = this.extractEntities(text);
    if (entities.emails.length > 0) tags.push('contains-email');
    if (entities.currencies.length > 0) tags.push('financial-data');
    if (entities.dates.length > 0) tags.push('time-sensitive');
    if (entities.urls.length > 0) tags.push('contains-links');

    // Add content-based tags
    const keyPhrases = this.extractKeyPhrases(text);
    tags.push(...keyPhrases.slice(0, 3));

    return [...new Set(tags)]; // Remove duplicates
  }

  /**
   * Check if word is a stop word
   */
  isStopWord(word) {
    const stopWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from', 'this', 'that', 'these', 'those', 'will', 'would', 'could', 'should', 'can', 'may', 'might'];
    return stopWords.includes(word.toLowerCase());
  }

  /**
   * Search documents using semantic matching
   */
  searchDocuments(query, documents) {
    const queryLower = query.toLowerCase();
    const results = [];

    for (const doc of documents) {
      let score = 0;
      const content = (doc.textContent || doc.description || '').toLowerCase();

      // Exact phrase matching
      if (content.includes(queryLower)) {
        score += 10;
      }

      // Individual word matching
      const queryWords = queryLower.split(/\s+/);
      queryWords.forEach(word => {
        if (content.includes(word)) {
          score += 2;
        }
      });

      // Category matching
      if (doc.category && doc.category.toLowerCase().includes(queryLower)) {
        score += 5;
      }

      // Tag matching
      if (doc.tags && doc.tags.some(tag => tag.toLowerCase().includes(queryLower))) {
        score += 3;
      }

      if (score > 0) {
        results.push({ document: doc, score });
      }
    }

    return results
      .sort((a, b) => b.score - a.score)
      .map(r => r.document);
  }
}

// Usage example:
/*
const aiService = new DocumentIntelligenceService();

// On file upload
const analysis = await aiService.analyzeDocument(file);
console.log('Document analysis:', analysis);

// Save enhanced metadata to database
const enhancedMetadata = {
  ...originalMetadata,
  ai_category: analysis.category.category,
  ai_confidence: analysis.category.confidence,
  ai_tags: analysis.tags,
  ai_summary: analysis.summary,
  ai_entities: analysis.entities,
  language: analysis.language
};

// Search documents
const searchResults = aiService.searchDocuments('financial reports', allDocuments);
*/
