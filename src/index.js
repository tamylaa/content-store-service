/**
 * Content Store Service - Minimal Viable Product
 * Handles file uploads with authentication using existing auth service
 * Aligned with production auth service endpoints
 */

import { authenticate, createAuthResponse } from './middleware/auth-aligned.js';

// CORS headers for browser compatibility - restrictive for security
const getCorsHeaders = (env, request) => {
  const allowedOrigins = env.CORS_ORIGINS?.split(',') || [
    'https://tamyla.com',
    'https://www.tamyla.com',
    'https://trading.tamyla.com'
  ];
  
  // Get the origin from the request
  const requestOrigin = request?.headers?.get('Origin');
  
  // Check if origin is allowed
  let allowedOrigin = allowedOrigins[0]; // default fallback
  
  if (requestOrigin) {
    // Check exact matches first
    if (allowedOrigins.includes(requestOrigin)) {
      allowedOrigin = requestOrigin;
    }
    // Check for *.tamyla.com subdomains (must be https)
    else if (requestOrigin.startsWith('https://') && 
             (requestOrigin.endsWith('.tamyla.com') || requestOrigin === 'https://tamyla.com')) {
      allowedOrigin = requestOrigin;
    }
  }
  
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400'
  };
};

/**
 * Hybrid authentication function that tries JWT first, then falls back to session auth
 * @param {Request} request 
 * @param {Object} env 
 * @returns {Object} Authentication result
 */
async function authenticateRequest(request, env) {
  // Simple authentication using existing auth service
  return await authenticate(request, env);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = getCorsHeaders(env, request);
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }
    
    try {
      // Health check endpoint
      if (url.pathname === '/health') {
        return new Response(
          JSON.stringify({ 
            status: 'healthy', 
            service: 'content-store-service',
            timestamp: new Date().toISOString()
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }
      
      // Upload endpoint
      if (url.pathname === '/api/v1/content/upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }
      
      // Default 404
      return new Response(
        JSON.stringify({ error: 'Not found' }),
        { 
          status: 404, 
          headers: { 
            'Content-Type': 'application/json',
            ...corsHeaders 
          } 
        }
      );
      
    } catch (error) {
      console.error('Request error:', error);
      return new Response(
        JSON.stringify({ 
          error: 'Internal server error',
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
};

async function handleUpload(request, env) {
  // Authenticate request using existing auth service
  const authResult = await authenticateRequest(request, env);

  if (!authResult.success) {
    return createAuthResponse(
      {
        success: false,
        error: authResult.error,
        code: authResult.code
      },
      env,
      request,
      401
    );
  }  try {
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
      metadata: {
        originalName: file.name,
        uploadedBy: authResult.user.id,
        uploadedAt: new Date().toISOString(),
        contentType: file.type || 'application/octet-stream'
      }
    });
    
    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        file: {
          id: fileId,
          name: file.name,
          path: filePath,
          size: file.size,
          type: file.type,
          url: `https://content.tamyla.com/api/v1/content/${fileId}`
        }
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
