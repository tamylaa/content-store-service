/**
 * Content Store Service - Main Entry Point
 * Modular, clean URL structure with security-first design
 * File size: <350 lines (cardinal principle)
 */

import { handleUpload } from './handlers/upload.js';
import { handleFileAccess } from './handlers/access.js';
import { handleListFiles } from './handlers/files.js';
import { handleTogglePublic, handleListPublicFiles } from './handlers/public.js';
import { getCorsHeaders } from './utils/cors.js';

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
            timestamp: new Date().toISOString(),
            version: '2.0.0'
          }),
          { 
            headers: { 
              'Content-Type': 'application/json',
              ...corsHeaders 
            } 
          }
        );
      }

      // Test endpoint for debugging data-service connection
      if (url.pathname === '/test-data-service' && request.method === 'GET') {
        try {
          let response, data;
          
          if (env.DATA_SERVICE) {
            console.log('Testing DATA_SERVICE binding');
            
            // Test service binding
            const mockRequest = new Request('https://data-service/files', {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            response = await env.DATA_SERVICE.fetch(mockRequest);
            data = await response.text();
            console.log('Service binding response status:', response.status);
            console.log('Service binding response:', data);
            
            return new Response(
              JSON.stringify({
                success: true,
                method: 'service-binding',
                status: response.status,
                statusText: response.statusText,
                data: data
              }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              }
            );
          } else {
            console.log('No service binding, testing HTTP');
            const dataServiceUrl = env.DATA_SERVICE_URL || 'https://data-service.tamylatrading.workers.dev/files';
            console.log('Testing data-service URL:', dataServiceUrl);
            
            response = await fetch(dataServiceUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json'
              }
            });
            
            data = await response.text();
            console.log('HTTP response status:', response.status);
            console.log('HTTP response:', data);
            
            return new Response(
              JSON.stringify({
                success: true,
                method: 'http',
                dataServiceUrl,
                status: response.status,
                statusText: response.statusText,
                data: data
              }),
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...corsHeaders
                }
              }
            );
          }
        } catch (error) {
          return new Response(
            JSON.stringify({
              success: false,
              error: error.message,
              stack: error.stack
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
      
      // Upload endpoint - POST /upload
      if (url.pathname === '/upload' && request.method === 'POST') {
        return await handleUpload(request, env);
      }
      
      // NEW: File access endpoint - GET /access/{fileId}
      // Supports both authenticated access and signed URLs
      // Clean URL: /access/c08502e0-bf53-45dd-9521-f0d8c427d40a
      // Signed URL: /access/c08502e0-bf53-45dd-9521-f0d8c427d40a?signature=xxx&expires=xxx
      if (url.pathname.startsWith('/access/') && request.method === 'GET') {
        const fileId = url.pathname.split('/access/')[1];
        return await handleFileAccess(fileId, request, env);
      }
      
      // Legacy: Download endpoint - GET /download/{fileId} (backward compatibility)
      if (url.pathname.startsWith('/download/') && request.method === 'GET') {
        const fileId = url.pathname.split('/download/')[1];
        return await handleFileAccess(fileId, request, env);
      }
      

      // List user's files endpoint - GET /files
      if (url.pathname === '/files' && request.method === 'GET') {
        return await handleListFiles(request, env);
      }

      // API to generate signed/proxy URLs for file access (for content-ai-analysis)
      // POST /generate-signed-url { fileId }
      if (url.pathname === '/generate-signed-url' && request.method === 'POST') {
        const { generateSignedUrl } = await import('./helpers/file-security.js');
        const authResult = await (await import('./middleware/jwt-auth.js')).authenticateJWT(request, env);
        if (!authResult.success) {
          return new Response(JSON.stringify({ success: false, error: authResult.error }), { status: 401, headers: corsHeaders });
        }
        const body = await request.json();
        const fileId = body.fileId;
        if (!fileId) {
          return new Response(JSON.stringify({ success: false, error: 'Missing fileId' }), { status: 400, headers: corsHeaders });
        }
        // Only allow owner to generate signed URL
        const { checkFileOwnership } = await import('./helpers/file-security.js');
        const ownership = await checkFileOwnership(fileId, authResult.user.id, env);
        if (!ownership.exists || !ownership.owned) {
          return new Response(JSON.stringify({ success: false, error: 'Not authorized for this file' }), { status: 403, headers: corsHeaders });
        }
        const signedUrl = generateSignedUrl(fileId, authResult.user.id, env, 60);
        return new Response(JSON.stringify({ success: true, signedUrl: `${env.CONTENT_SERVICE_URL || 'https://content-store-service.tamylatrading.workers.dev'}${signedUrl}` }), { headers: corsHeaders });
      }
      
      // NEW: Toggle file public status - PUT /access/{fileId}/public
      if (url.pathname.match(/^\/access\/[^\/]+\/public$/) && request.method === 'PUT') {
        const fileId = url.pathname.split('/')[2]; // Extract fileId from /access/{fileId}/public
        return await handleTogglePublic(fileId, request, env);
      }
      
      // NEW: List public files - GET /public
      if (url.pathname === '/public' && request.method === 'GET') {
        return await handleListPublicFiles(request, env);
      }
      
      // Legacy: Old API format (backward compatibility)
      // /api/v1/content/{fileId} -> redirect to /access/{fileId}
      if (url.pathname.startsWith('/api/v1/content/') && request.method === 'GET') {
        const fileId = url.pathname.split('/api/v1/content/')[1];
        const newUrl = new URL(request.url);
        newUrl.pathname = `/access/${fileId}`;
        
        return Response.redirect(newUrl.toString(), 301); // Permanent redirect
      }
      
      // Default 404
      return new Response(
        JSON.stringify({ 
          error: 'Not found',
          availableEndpoints: [
            'POST /upload - Upload a file',
            'GET /access/{fileId} - Access file (auth or signed)',
            'PUT /access/{fileId}/public - Toggle file public status',
            'GET /public - List public files',
            'GET /files - List user files',
            'GET /health - Health check'
          ]
        }),
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
