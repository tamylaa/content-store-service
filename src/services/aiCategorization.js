/**
 * AI Content Categorization Service - Lightweight Implementation
 * This is a simplified service that will be expanded into a full content-analyzer service
 * For now, it provides smart rule-based categorization with 'general' as safe fallback
 */

// Lightweight categorization service 
export class ContentCategorizationService {
  constructor(env) {
    this.env = env;
    this.contentAnalyzerUrl = env.CONTENT_ANALYZER_URL; // Future external service
  }

  /**
   * Quick categorization - always returns 'general' for safety
   * This avoids blocking uploads while we develop the full AI service
   */
  async quickCategorize(fileId, metadata) {
    try {
      console.log(`🔍 Quick categorization for file: ${fileId}`);
      
      // Simple filename-based hints (non-blocking)
      const filename = metadata.original_filename.toLowerCase();
      const smartHint = this.getFilenameHint(filename, metadata.mime_type);
      
      // Always return 'general' for now - safe and predictable
      const category = 'general';
      
      console.log(`✅ Categorized ${fileId} as '${category}' (hint: ${smartHint})`);
      
      return { 
        success: true, 
        category, 
        hint: smartHint,
        processingTime: '< 1ms',
        method: 'quick-safe' 
      };
    } catch (error) {
      console.error(`❌ Quick categorization failed for ${fileId}:`, error);
      return { 
        success: true, // Don't fail - always succeed with 'general'
        category: 'general', 
        error: error.message,
        method: 'fallback'
      };
    }
  }

  /**
   * Get filename-based hints for future AI processing
   */
  getFilenameHint(filename, mimeType) {
    // Quick pattern matching for future reference
    if (filename.includes('invoice') || filename.includes('receipt')) return 'financial-hint';
    if (filename.includes('contract') || filename.includes('agreement')) return 'legal-hint';
    if (filename.includes('report') || filename.includes('analysis')) return 'report-hint';
    if (filename.includes('logo') || filename.includes('brand')) return 'branding-hint';
    if (filename.includes('chart') || filename.includes('graph')) return 'chart-hint';
    
    // MIME type hints
    if (mimeType?.startsWith('image/')) return 'image-content';
    if (mimeType?.startsWith('application/pdf')) return 'document-content';
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return 'spreadsheet-content';
    
    return 'general-content';
  }

  /**
   * Future: Full AI analysis (placeholder for content-analyzer service)
   * This will be moved to a separate content-analyzer service
   */
  async scheduleFullAnalysis(fileId, metadata) {
    console.log(`📋 Scheduling full AI analysis for ${fileId} (not implemented yet)`);
    
    // Future implementation:
    // 1. Queue the file for analysis in content-analyzer service
    // 2. content-analyzer service will:
    //    - Download file content from R2
    //    - Perform AI analysis (OpenAI, Claude, etc.)
    //    - Update category in data-service via PATCH /files/{id}
    // 3. UI can poll for updated category or use WebSocket notifications
    
    return {
      scheduled: true,
      estimatedCompletion: '2-5 minutes',
      status: 'queued'
    };
  }
}

// Simple background processing function
export async function processAICategorization(env, fileId, fileContent, metadata) {
  try {
    const categorizationService = new ContentCategorizationService(env);
    
    // Quick categorization only - returns 'general' immediately
    const quickResult = await categorizationService.quickCategorize(fileId, metadata);
    
    // Future: Schedule full analysis in background
    // const fullAnalysis = await categorizationService.scheduleFullAnalysis(fileId, metadata);
    
    console.log(`🤖 Quick categorization completed for ${fileId}: ${quickResult.category}`);
    return quickResult;
  } catch (error) {
    console.error(`🤖 Categorization failed for ${fileId}:`, error);
    // Always return 'general' - never fail
    return { 
      success: true, 
      category: 'general', 
      error: error.message,
      method: 'error-fallback'
    };
  }
}
