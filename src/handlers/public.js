/**
 * Public Handler - Manage Public File Status
 * Handles making files public/private and listing public files
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { checkFileOwnership, createAccessDeniedResponse, createFileNotFoundResponse } from '../helpers/file-security.js';
import { getCorsHeaders } from '../utils/cors.js';

/**
 * Toggle public status of a file
 * PUT /access/{fileId}/public
 */
export async function handleTogglePublic(fileId, request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  // Authenticate request - only file owner can change public status
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
    const { isPublic } = await request.json();
    
    if (typeof isPublic !== 'boolean') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'isPublic must be a boolean value' 
        }),
        { 
          status: 400, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
    }

    // Check file ownership
    const ownershipCheck = await checkFileOwnership(fileId, authResult.user.id, env);
    if (!ownershipCheck.exists) {
      return createFileNotFoundResponse(corsHeaders);
    }
    
    if (!ownershipCheck.owned) {
      return createAccessDeniedResponse(
        'You can only modify your own files',
        corsHeaders
      );
    }

    // Update the file metadata
    const existingMetadata = ownershipCheck.file.customMetadata || {};
    const updatedMetadata = {
      ...existingMetadata,
      isPublic: isPublic.toString(),
      lastModified: new Date().toISOString()
    };

    // Re-upload with updated metadata (R2 doesn't support metadata-only updates)
    await env.CONTENT_BUCKET.put(ownershipCheck.fileKey, ownershipCheck.file.body, {
      customMetadata: updatedMetadata,
      httpMetadata: ownershipCheck.file.httpMetadata
    });

    return new Response(
      JSON.stringify({
        success: true,
        fileId: fileId,
        isPublic: isPublic,
        message: `File ${isPublic ? 'made public' : 'made private'} successfully`
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('Toggle public error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to update file status' 
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

/**
 * List all public files
 * GET /public
 */
export async function handleListPublicFiles(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  try {
    if (!env.CONTENT_BUCKET) {
      throw new Error('Storage not configured');
    }

    // List all files in uploads directory
    const listResult = await env.CONTENT_BUCKET.list({
      prefix: 'uploads/',
      delimiter: ''
    });

    const publicFiles = [];
    
    // Check each file to see if it's public
    for (const object of listResult.objects) {
      try {
        const file = await env.CONTENT_BUCKET.get(object.key);
        if (file && file.customMetadata?.isPublic === 'true') {
          const fileName = object.key.split('/').pop();
          const fileId = fileName ? fileName.split('.')[0] : null;
          
          if (fileId) {
            publicFiles.push({
              id: fileId,
              name: file.customMetadata.originalName || fileName,
              size: object.size,
              contentType: file.customMetadata.contentType || 'application/octet-stream',
              uploadedAt: file.customMetadata.uploadedAt,
              url: `${env.CONTENT_SERVICE_URL || 'https://content-store-service.tamylatrading.workers.dev'}/access/${fileId}`
            });
          }
        }
      } catch (error) {
        console.warn('Error checking file public status:', object.key, error);
        // Continue with other files
      }
    }

    // Sort by upload date (newest first)
    publicFiles.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return new Response(
      JSON.stringify({
        success: true,
        publicFiles: publicFiles,
        count: publicFiles.length
      }),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );

  } catch (error) {
    console.error('List public files error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to list public files' 
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
