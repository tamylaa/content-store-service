/**
 * Simple JWT Authentication Middleware
 * Uses built-in crypto for JWT validation - no external dependencies
 * Based on the same pattern used in the auth-service
 */

export async function authenticate(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return {
        success: false,
        error: 'No authorization header provided'
      };
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    
    if (!token) {
      return {
        success: false,
        error: 'No token provided'
      };
    }

    // Use the same JWT verification logic as auth-service
    const jwtSecret = env.AUTH_JWT_SECRET || env.JWT_SECRET;
    
    if (!jwtSecret) {
      console.error('JWT secret not configured');
      return {
        success: false,
        error: 'Authentication not configured'
      };
    }

    // Simple JWT verification using the same method as auth-service
    try {
      const payload = await verifyJWT(token, jwtSecret);
      
      // Validate token hasn't expired
      if (payload.exp && Date.now() >= payload.exp * 1000) {
        return {
          success: false,
          error: 'Token has expired'
        };
      }

      // Return user info
      return {
        success: true,
        user: {
          id: payload.userId || payload.sub,
          email: payload.email,
          exp: payload.exp,
          iat: payload.iat
        }
      };
      
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError.message);
      return {
        success: false,
        error: 'Invalid or expired token'
      };
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Verify JWT token using Web Crypto API (same as auth-service)
 */
async function verifyJWT(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format');
  }
  
  const [header, payload, signature] = parts;
  
  // Verify signature
  const encoder = new TextEncoder();
  const data = `${header}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify']
  );
  
  const signatureBytes = Uint8Array.from(atob(signature.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
  const isValid = await crypto.subtle.verify('HMAC', key, signatureBytes, encoder.encode(data));
  
  if (!isValid) {
    throw new Error('Invalid signature');
  }
  
  // Decode payload
  const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  return decodedPayload;
}

/**
 * Express-style middleware wrapper for easy integration
 */
export function requireAuth(env) {
  return async (request) => {
    const result = await authenticate(request, env);
    
    if (!result.success) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        { 
          status: 401, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }
    
    // Attach user to request for downstream handlers
    request.user = result.user;
    return null; // Continue processing
  };
}
