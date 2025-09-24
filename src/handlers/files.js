/**
 * Files Handler - List User Files
 * Handles listing of user's uploaded files
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { getCorsHeaders } from '../utils/cors.js';
import { listUserFiles, listUserFilesOptimized } from '../utils/storage.js';
import { getSessionUploads } from '../utils/session-cache.js';

// NEW ENHANCED ENDPOINTS

// Get user's recent session uploads (instant feedback)
export async function handleSessionFiles(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  const authResult = await authenticateJWT(request, env);
  if (!authResult.success) {
    return createJWTResponse({
      success: false,
      error: authResult.error,
      code: authResult.code
    }, env, request, 401);
  }

  try {
    const sessionUploads = getSessionUploads(authResult.user.id) || [];
    
    return new Response(JSON.stringify({
      success: true,
      files: sessionUploads,
      count: sessionUploads.length,
      message: `Found ${sessionUploads.length} recent uploads in current session`
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Session files error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get session files'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

// Get file statistics and summary info
export async function handleFileStats(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  const authResult = await authenticateJWT(request, env);
  if (!authResult.success) {
    return createJWTResponse({
      success: false,
      error: authResult.error,
      code: authResult.code
    }, env, request, 401);
  }

  try {
    // Get session uploads
    const sessionUploads = getSessionUploads(authResult.user.id) || [];
    
    // Get stats from data-service (this would need to be implemented in data-service)
    // For now, we'll return basic stats
    const stats = {
      sessionUploads: sessionUploads.length,
      // These would come from data-service API calls:
      totalFiles: 0, // TODO: Implement data-service stats endpoint
      totalSize: 0,  // TODO: Implement data-service stats endpoint
      categories: {}, // TODO: Implement data-service stats endpoint
      recentActivity: sessionUploads.slice(0, 5) // Most recent 5 uploads
    };
    
    return new Response(JSON.stringify({
      success: true,
      stats,
      message: 'File statistics retrieved successfully'
    }), {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('File stats error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to get file statistics'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    });
  }
}

export async function handleListFiles(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  // Authenticate request
  const authResult = await authenticateJWT(request, env);

  if (!authResult.success) {
    return createJWTResponse(
      {
        success: false,
        error: authResult.error,
        code: authResult.code
      },
      env,
      request,
      401
    );
  }

  try {
    // Parse query parameters for pagination and filtering
    const url = new URL(request.url);
    const options = {
      page: parseInt(url.searchParams.get('page')) || 1,
      limit: Math.min(parseInt(url.searchParams.get('limit')) || 20, 100), // Max 100 items
      period: url.searchParams.get('period') || 'all',
      category: url.searchParams.get('category') || 'all',
      search: url.searchParams.get('search') || '',
      sort: url.searchParams.get('sort') || 'recent'
    };

    console.log('List files request with options:', options);

    // Get session uploads for instant feedback (recent uploads appear immediately)
    const sessionUploads = getSessionUploads(authResult.user.id) || [];
    
    // Use optimized function that queries data-service instead of scanning R2
    const authHeader = request.headers.get('Authorization');
    const result = await listUserFilesOptimized(authResult.user.id, options, env, authHeader);
    
    // Merge session uploads with database results (deduplicate by ID)
    const sessionUploadIds = new Set(sessionUploads.map(f => f.id));
    const historicalFiles = (result.files || []).filter(f => !sessionUploadIds.has(f.id));
    
    // Combine session uploads (most recent first) with historical files
    const allFiles = [...sessionUploads, ...historicalFiles];
    
    // Apply pagination to combined results if needed
    const startIndex = (options.page - 1) * options.limit;
    const endIndex = startIndex + options.limit;
    const paginatedFiles = allFiles.slice(startIndex, endIndex);
    
    const totalCount = sessionUploads.length + (result.total || 0);
    
    return new Response(
      JSON.stringify({
        success: true,
        files: paginatedFiles,
        pagination: {
          page: options.page,
          limit: options.limit,
          total: totalCount,
          hasNext: endIndex < totalCount,
          hasPrev: options.page > 1
        },
        sessionCount: sessionUploads.length,
        historicalCount: result.total || 0,
        // Backward compatibility
        count: paginatedFiles.length
      }),
      {
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );

  } catch (error) {
    console.error('List files error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Failed to list files',
        details: env.ENVIRONMENT === 'development' ? error.message : undefined
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders
        }
      }
    );
  }
}
