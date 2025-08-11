import { authenticateJWT, createJWTResponse } from '../middleware/jwt-auth.js';
import { getSessionUploads } from '../utils/session-cache.js';
import { getCorsHeaders } from '../utils/cors.js';

export async function handleUploadSession(request, env) {
  const corsHeaders = getCorsHeaders(env, request);
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
  const uploads = getSessionUploads(authResult.user.id);
  return new Response(
    JSON.stringify({ success: true, uploads }),
    {
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders
      }
    }
  );
}
