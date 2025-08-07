/**
 * Access Handler - File Access Logic
 * Handles both authenticated downloads and signed URL access
 * New clean URL structure: /access/{fileId} with optional query params
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { 
  verifySignedUrl, 
  checkFileOwnership, 
  createAccessDeniedResponse 
} from '../helpers/file-security.js';
import { getCorsHeaders } from '../utils/cors.js';
import { findFileInStorage, getFileFromStorage } from '../utils/storage.js';

export async function handleFileAccess(fileId, request, env) {
  const corsHeaders = getCorsHeaders(env, request);
  const url = new URL(request.url);
  
  // Check if this is a signed URL request
  const signature = url.searchParams.get('signature');
  const expires = url.searchParams.get('expires');
  
  let authResult = null;
  let isSignedRequest = false;
  let isAnonymousRequest = false;
  
  if (signature && expires) {
    // This is a signed URL request - verify the signature
    isSignedRequest = true;
    const signedUrlPath = url.pathname + url.search;
    const signatureVerification = await verifySignedUrl(signedUrlPath, env);
    
    if (!signatureVerification.valid) {
      return createAccessDeniedResponse(signatureVerification.error, corsHeaders);
    }
    
    // For signed URLs, we don't need JWT authentication
    authResult = { success: true, user: { id: signatureVerification.userId } };
  } else {
    // This could be an authenticated request or public file access
    authResult = await authenticateJWT(request, env);
    
    if (!authResult.success) {
      // No authentication - this could be a public file request
      isAnonymousRequest = true;
      authResult = null;
    }
  }
  
  try {
    if (!fileId) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'File ID is required' 
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

    // First, check if file exists regardless of user
    const ownershipCheck = await checkFileOwnership(fileId, 'anonymous', env);
    if (!ownershipCheck.exists) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: ownershipCheck.error || 'File not found' 
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

    // Check if file is public
    const isPublicFile = ownershipCheck.file.customMetadata?.isPublic === 'true';
    
    // Determine access permission
    let hasAccess = false;
    let accessReason = '';
    
    if (isPublicFile) {
      hasAccess = true;
      accessReason = 'public file';
    } else if (isSignedRequest) {
      hasAccess = true;
      accessReason = 'valid signed URL';
    } else if (authResult && authResult.user && ownershipCheck.owner === authResult.user.id) {
      hasAccess = true;
      accessReason = 'file owner';
    } else if (isAnonymousRequest) {
      return createJWTResponse(
        {
          success: false,
          error: 'Authentication required for private files',
          code: 'AUTH_REQUIRED'
        },
        env,
        request,
        401
      );
    } else {
      hasAccess = false;
      accessReason = 'not file owner';
    }
    
    if (!hasAccess) {
      console.log(`Access denied: User ${authResult?.user?.id} tried to access file owned by ${ownershipCheck.owner} (${accessReason})`);
      return createAccessDeniedResponse(
        'You can only download your own files or public files',
        corsHeaders
      );
    }
    
    console.log(`Access granted: ${accessReason} for file ${fileId}`);

    // Use the file from ownership check (already retrieved)
    const file = ownershipCheck.file;
    const foundObject = ownershipCheck.foundObject;

    // Get original filename from metadata
    const originalName = file.customMetadata?.originalName || foundObject.key.split('/').pop();
    const contentType = file.customMetadata?.contentType || file.httpMetadata?.contentType || 'application/octet-stream';

    // Return the file with appropriate headers
    const responseHeaders = {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${originalName}"`,
      ...corsHeaders
    };
    
    // Add cache headers for signed URLs (they're time-limited anyway)
    if (isSignedRequest) {
      responseHeaders['Cache-Control'] = 'private, max-age=300'; // 5 minutes
    } else {
      responseHeaders['Cache-Control'] = 'private, no-cache';
    }

    return new Response(file.body, {
      headers: responseHeaders
    });

  } catch (error) {
    console.error('Download error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Download failed' 
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
