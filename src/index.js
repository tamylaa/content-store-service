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
