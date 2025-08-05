/**
 * JWT Authentication middleware
 * Uses token introspection with auth-service instead of shared secrets
 */

export async function authenticate(request, env) {
  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
      return {
        success: false,
        error: 'No authorization header provided'
      };
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token) {
      return {
        success: false,
        error: 'No token provided'
      };
    }

    // Use token introspection instead of JWT verification
    const userValidation = await introspectToken(token, env);
    
    if (!userValidation.success) {
      return {
        success: false,
        error: userValidation.error || 'Invalid token'
      };
    }

    return {
      success: true,
      user: userValidation.user
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return {
      success: false,
      error: 'Authentication failed'
    };
  }
}

/**
 * Introspect token with auth service
 * This is more secure than sharing JWT secrets
 */
async function introspectToken(token, env) {
  try {
    const authServiceUrl = env.AUTH_SERVICE_URL || 'https://auth-service.tamylatrading.workers.dev';
    
    const response = await fetch(`${authServiceUrl}/auth/introspect`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ token })
    });

    if (!response.ok) {
      console.error('Token introspection failed:', response.status, response.statusText);
      return {
        success: false,
        error: 'Token validation failed'
      };
    }

    const result = await response.json();
    
    if (!result.active) {
      return {
        success: false,
        error: result.error || 'Invalid token'
      };
    }

    // Extract user info from introspection response
    return {
      success: true,
      user: {
        id: result.sub,
        email: result.email,
        exp: result.exp,
        iat: result.iat
      }
    };

  } catch (error) {
    console.error('Token introspection error:', error);
    return {
      success: false,
      error: 'Token validation service unavailable'
    };
  }
}

/**
 * Simple JWT verification
 * In production, use a proper JWT library or Cloudflare's JWT verification
 */
async function verifyJWT(token, secret) {
  try {
    // Split the token
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [header, payload, signature] = parts;

    // Decode header and payload
    const decodedHeader = JSON.parse(atob(header.replace(/-/g, '+').replace(/_/g, '/')));
    const decodedPayload = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));

    // For now, we'll do basic validation
    // In production, properly verify the signature with the secret
    if (decodedHeader.alg !== 'HS256') {
      throw new Error('Unsupported algorithm');
    }

    // Basic payload validation
    if (!decodedPayload.sub && !decodedPayload.user_id) {
      throw new Error('Missing user identifier');
    }

    return decodedPayload;

  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user, permission) {
  if (user.role === 'admin') {
    return true;
  }
  
  return user.permissions && user.permissions.includes(permission);
}

/**
 * Rate limiting middleware
 */
export async function checkRateLimit(request, env, limitType = 'api') {
  try {
    const userKey = request.user?.id || getClientIP(request);
    const rateLimitKey = `ratelimit:${limitType}:${userKey}`;
    
    if (!env.CONTENT_CACHE) {
      return { success: true }; // No rate limiting if cache not available
    }

    const current = await env.CONTENT_CACHE.get(rateLimitKey);
    const limit = getLimit(limitType);
    const window = 60; // 1 minute window

    if (current && parseInt(current) >= limit) {
      return {
        success: false,
        error: `Rate limit exceeded. Maximum ${limit} requests per minute.`
      };
    }

    // Increment counter
    const newCount = current ? parseInt(current) + 1 : 1;
    await env.CONTENT_CACHE.put(rateLimitKey, newCount.toString(), { expirationTtl: window });

    return { success: true };

  } catch (error) {
    console.error('Rate limiting error:', error);
    return { success: true }; // Don't block on rate limiting errors
  }
}

/**
 * Get rate limit based on type
 */
function getLimit(limitType) {
  switch (limitType) {
    case 'upload':
      return 10; // 10 uploads per minute
    case 'api':
      return 100; // 100 API calls per minute
    default:
      return 60; // Default 60 requests per minute
  }
}

/**
 * Get client IP address
 */
function getClientIP(request) {
  return request.headers.get('CF-Connecting-IP') || 
         request.headers.get('X-Forwarded-For') || 
         'unknown';
}
