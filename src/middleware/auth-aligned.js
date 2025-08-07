/**
 * Simple Authentication Middleware for Content Store Service
 * Uses existing auth service endpoints - no complex migration needed
 * Aligns with production auth service at https://auth.tamyla.com
 */

/**
 * Authenticate request using existing auth service
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Object} Authentication result
 */
export async function authenticate(request, env) {
  try {
    // Extract token using standard method
    const token = extractToken(request);
    
    if (!token) {
      return createAuthError('AUTH_REQUIRED', 'No token provided');
    }

    // Use existing auth service introspect endpoint
    const authServiceUrl = env.AUTH_SERVICE_URL || 'https://auth.tamyla.com';
    
    try {
      const response = await fetch(`${authServiceUrl}/auth/introspect`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token: token })
      });

      if (!response.ok) {
        console.error('Auth service introspection failed:', response.status);
        return createAuthError('AUTH_SERVICE_ERROR', 'Authentication service error');
      }

      const result = await response.json();
      
      if (!result.active) {
        return createAuthError('INVALID_TOKEN', result.error || 'Token is not active');
      }

      // Transform introspection result to our expected format
      return {
        success: true,
        user: {
          id: result.sub,
          email: result.email
        },
        token: token,
        expiresAt: result.exp ? new Date(result.exp * 1000) : null,
        source: 'auth-service-introspect'
      };

    } catch (error) {
      console.error('Error calling auth service:', error);
      return createAuthError('AUTH_SERVICE_UNAVAILABLE', 'Authentication service unavailable');
    }

  } catch (error) {
    console.error('Authentication error:', error);
    return createAuthError('AUTH_SYSTEM_ERROR', 'Authentication failed');
  }
}

/**
 * Extract token from request using standard priority order
 * @param {Request} request 
 * @returns {string|null} Token or null
 */
function extractToken(request) {
  // Priority 1: Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Priority 2: Cookie (session_token)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    if (cookies.session_token) {
      return cookies.session_token;
    }
  }
  
  // Priority 3: Query parameter (for webhooks only)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }
  
  return null;
}

/**
 * Parse cookies from Cookie header
 * @param {string} cookieHeader 
 * @returns {Object} Parsed cookies
 */
function parseCookies(cookieHeader) {
  if (!cookieHeader) return {};
  
  return cookieHeader.split(';').reduce((cookies, cookie) => {
    const [key, value] = cookie.trim().split('=');
    if (key && value) {
      cookies[key] = decodeURIComponent(value);
    }
    return cookies;
  }, {});
}

/**
 * Create standardized error response
 * @param {string} code 
 * @param {string} message 
 * @returns {Object} Error response
 */
function createAuthError(code, message) {
  return {
    success: false,
    error: message,
    code: code,
    timestamp: new Date().toISOString(),
    source: 'auth-service'
  };
}

/**
 * Create authenticated HTTP response with proper CORS headers
 * @param {Object} data - Response data
 * @param {Object} env - Environment variables
 * @param {Request} request - Original request for CORS origin
 * @param {number} status - HTTP status code
 * @returns {Response} HTTP response
 */
export function createAuthResponse(data, env, request, status = 200) {
  const corsHeaders = getCorsHeaders(env, request);
  
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  });
}

/**
 * Get CORS headers for authenticated responses
 * @param {Object} env 
 * @param {Request} request 
 * @returns {Object} CORS headers
 */
function getCorsHeaders(env, request) {
  const allowedOrigins = env.CORS_ORIGINS?.split(',') || [
    'https://tamyla.com',
    'https://www.tamyla.com',
    'https://trading.tamyla.com',
    'https://content.tamyla.com'
  ];
  
  const requestOrigin = request?.headers?.get('Origin');
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
}
