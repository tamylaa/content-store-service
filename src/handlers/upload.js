/**
 * Upload Handler - File Upload Logic
 * Handles multipart form data uploads with authentication
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { createEnhancedUploadResponse } from '../helpers/file-security.js';
import { apiFetch } from '../utils/fetch.js';
import { addUploadToSession } from '../utils/session-cache.js';
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
    
    // Prepare metadata for data-service
    const metadata = {
      id: fileId,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      created_at: new Date().toISOString(),
      owner_id: authResult.user.id,
      storage_path: filePath,
      is_public: false,
      category: formData.get('category') || null,
      checksum: formData.get('checksum') || `sha256-placeholder-${fileId}`, // Generate a placeholder checksum
      last_accessed_at: null,
      download_count: 0
    };

    // Persist metadata to data-service using service binding
    let persistedMetadata;
    try {
      console.log('Attempting to persist metadata using service binding');
      console.log('Metadata payload:', JSON.stringify(metadata));
      
      // Use service binding if available, fallback to HTTP
      if (env.DATA_SERVICE) {
        console.log('Using DATA_SERVICE binding');
        
        // Create a mock request for the data-service
        const mockRequest = new Request('https://data-service/files', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': request.headers.get('Authorization') || ''
          },
          body: JSON.stringify(metadata)
        });
        
        // Call data-service directly via service binding
        const response = await env.DATA_SERVICE.fetch(mockRequest);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        
        persistedMetadata = await response.json();
        console.log('Metadata persistence successful via service binding:', persistedMetadata);
      } else {
        console.log('Service binding not available, falling back to HTTP');
        const dataServiceUrl = env.DATA_SERVICE_URL || 'https://data-service.tamylatrading.workers.dev/files';
        console.log('Using HTTP URL:', dataServiceUrl);
        
        persistedMetadata = await apiFetch(dataServiceUrl, {
          method: 'POST',
          headers: {
            Authorization: request.headers.get('Authorization') || ''
          },
          body: metadata
        });
        
        console.log('Metadata persistence successful via HTTP:', persistedMetadata);
      }
    } catch (err) {
      // Log but do not fail upload if metadata persistence fails
      console.error('Failed to persist file metadata:', err);
      console.error('Error details:', err.message, err.stack);
      persistedMetadata = { error: err.message };
    }

    // Create enhanced response with both authenticated and signed download URLs
    const enhancedResponse = await createEnhancedUploadResponse(fileId, file, filePath, authResult.user.id, env);

    // Add to session cache for instant UI feedback
    addUploadToSession(authResult.user.id, {
      id: fileId,
      original_filename: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/octet-stream',
      created_at: metadata.created_at,
      storage_path: filePath,
      ...persistedMetadata
    });

    return new Response(
      JSON.stringify({
        ...enhancedResponse,
        metadata: persistedMetadata
      }),
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
