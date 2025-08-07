/**
 * Upload Handler - File Upload Logic
 * Handles multipart form data uploads with authentication
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { createEnhancedUploadResponse } from '../helpers/file-security.js';
import { getCorsHeaders } from '../utils/cors.js';

export async function handleUpload(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  
  // Authenticate request using existing auth service
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
    // Get file from form data
    const formData = await request.formData();
    const file = formData.get('file');
    
    if (!file) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No file provided' 
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
    
    // Generate unique filename
    const fileId = crypto.randomUUID();
    const fileExtension = file.name.split('.').pop() || 'bin';
    const fileName = `${fileId}.${fileExtension}`;
    const filePath = `uploads/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;
    
    // Upload to R2 storage
    if (!env.CONTENT_BUCKET) {
      throw new Error('Storage not configured');
    }
    
    await env.CONTENT_BUCKET.put(filePath, file.stream(), {
      customMetadata: {
        originalName: file.name,
        uploadedBy: authResult.user.id,
        uploadedAt: new Date().toISOString(),
        contentType: file.type || 'application/octet-stream',
        isPublic: 'false' // Default to private
      }
    });
    
    // Create enhanced response with both authenticated and signed download URLs
    const enhancedResponse = await createEnhancedUploadResponse(fileId, file, filePath, authResult.user.id, env);
    
    return new Response(
      JSON.stringify(enhancedResponse),
      { 
        headers: { 
          'Content-Type': 'application/json',
          ...corsHeaders 
        } 
      }
    );
    
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Upload failed',
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
