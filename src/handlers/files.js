/**
 * Files Handler - List User Files
 * Handles listing of user's uploaded files
 */

import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { getCorsHeaders } from '../utils/cors.js';
import { listUserFiles } from '../utils/storage.js';

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
    const files = await listUserFiles(authResult.user.id, env);
    
    return new Response(
      JSON.stringify({
        success: true,
        files: files,
        count: files.length
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
