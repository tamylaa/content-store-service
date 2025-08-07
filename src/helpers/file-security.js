/**
 * File Security and Access Control Helper
 * Implements secure file access patterns for content service
 */

import { createJWTResponse } from '../middleware/jwt-auth.js';

/**
 * Generate a signed URL for secure file access
 * @param {string} fileId - The file ID
 * @param {string} userId - The user ID who owns the file
 * @param {Object} env - Environment variables
 * @param {number} expiresInMinutes - URL expiration time (default: 60 minutes)
 * @returns {string} Signed URL with expiration
 */
export function generateSignedUrl(fileId, userId, env, expiresInMinutes = 60) {
  const expiresAt = Math.floor(Date.now() / 1000) + (expiresInMinutes * 60);
  const payload = `${fileId}:${userId}:${expiresAt}`;
  
  // Create a simple signature using JWT secret
  const signature = btoa(payload + env.AUTH_JWT_SECRET).replace(/[+/=]/g, '');
  
  return `/download/${fileId}?signature=${signature}&expires=${expiresAt}&user=${userId}`;
}

/**
 * Verify a signed URL from the full URL path
 * @param {string} fullUrlPath - The full URL path including query parameters
 * @param {Object} env - Environment variables
 * @returns {Object} Verification result
 */
export function verifySignedUrl(fullUrlPath, env) {
  try {
    const url = new URL('https://example.com' + fullUrlPath);
    const signature = url.searchParams.get('signature');
    const expires = url.searchParams.get('expires');
    const urlUserId = url.searchParams.get('user');
    
    if (!signature || !expires || !urlUserId) {
      return { valid: false, error: 'Missing required parameters' };
    }
    
    // Extract fileId from path
    const pathParts = url.pathname.split('/');
    const fileId = pathParts[pathParts.length - 1];
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (parseInt(expires) < now) {
      return { valid: false, error: 'URL has expired' };
    }
    
    // Reconstruct expected signature
    const payload = `${fileId}:${urlUserId}:${expires}`;
    const expectedSignature = btoa(payload + env.AUTH_JWT_SECRET).replace(/[+/=]/g, '');
    
    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid signature' };
    }
    
    return { 
      valid: true, 
      userId: urlUserId, 
      fileId: fileId,
      expiresAt: parseInt(expires)
    };
    
  } catch (error) {
    return { valid: false, error: `URL parsing error: ${error.message}` };
  }
}

/**
 * Check if user owns a file
 * @param {string} fileId - The file ID
 * @param {string} userId - The user ID to check
 * @param {Object} env - Environment variables (with CONTENT_BUCKET)
 * @returns {Promise<Object>} Ownership check result
 */
export async function checkFileOwnership(fileId, userId, env) {
  try {
    if (!env.CONTENT_BUCKET) {
      throw new Error('Storage not configured');
    }

    // List objects to find the file with this ID
    const listResult = await env.CONTENT_BUCKET.list({
      prefix: 'uploads/',
      delimiter: ''
    });

    let foundObject = null;
    for (const object of listResult.objects) {
      const fileName = object.key.split('/').pop();
      if (fileName && fileName.startsWith(fileId + '.')) {
        foundObject = object;
        break;
      }
    }

    if (!foundObject) {
      return { exists: false, error: 'File not found' };
    }

    // Get the file metadata
    const file = await env.CONTENT_BUCKET.get(foundObject.key);
    
    if (!file) {
      return { exists: false, error: 'File not found' };
    }

    const uploadedBy = file.customMetadata?.uploadedBy;
    
    return {
      exists: true,
      owned: uploadedBy === userId,
      owner: uploadedBy,
      fileKey: foundObject.key,
      file: file,
      foundObject: foundObject
    };
  } catch (error) {
    return { exists: false, error: error.message };
  }
}

/**
 * Create an access denied response
 * @param {string} message - Error message
 * @param {Object} corsHeaders - CORS headers
 * @returns {Response} 403 response
 */
export function createAccessDeniedResponse(message, corsHeaders) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: message,
      code: 'ACCESS_DENIED'
    }),
    { 
      status: 403, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    }
  );
}

/**
 * Create a file not found response
 * @param {Object} corsHeaders - CORS headers
 * @returns {Response} 404 response
 */
export function createFileNotFoundResponse(corsHeaders) {
  return new Response(
    JSON.stringify({ 
      success: false, 
      error: 'File not found',
      code: 'FILE_NOT_FOUND'
    }),
    { 
      status: 404, 
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      } 
    }
  );
}

/**
 * Creates an enhanced upload response with both authentication methods
 * @param {string} fileId - The unique file identifier
 * @param {File} file - The uploaded file object
 * @param {string} filePath - The storage path of the file
 * @param {string} userId - The user ID who uploaded the file
 * @param {Object} env - Environment variables
 * @returns {Object} Enhanced response with multiple access options
 */
export async function createEnhancedUploadResponse(fileId, file, filePath, userId, env) {
  const baseUrl = env.CONTENT_SERVICE_URL || 'https://content-store-service.tamylatrading.workers.dev';
  
  // Generate signed URL for temporary access (1 hour)
  const signedUrlPath = generateSignedUrl(fileId, userId, env, 60);
  
  return {
    success: true,
    file: {
      id: fileId,
      name: file.name,
      path: filePath,
      size: file.size,
      type: file.type
    },
    access: {
      // New clean authenticated access URL
      authenticated: `${baseUrl}/access/${fileId}`,
      // Signed URL for temporary access (no auth required)
      signed: `${baseUrl}/access/${fileId}${signedUrlPath.split(fileId)[1]}`,
      // Expiry information
      signedExpiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      signedExpiresIn: '1 hour'
    },
    urls: {
      // Legacy URLs for backward compatibility
      download: `${baseUrl}/download/${fileId}`,
      // Old format for compatibility
      legacy: `${baseUrl}/api/v1/content/${fileId}`
    }
  };
}
