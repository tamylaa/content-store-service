/**
 * Universal Authentication Middleware for Tamyla Platform
 * 
 * This middleware provides consistent authentication across ALL Tamyla services.
 * Every service MUST use this exact implementation to ensure platform consistency.
 * 
 * Usage:
 *   import { authenticateRequest } from './middleware/tamyla-auth.js';
 *   const authResult = await authenticateRequest(request, env);
 */

/**
 * Main authentication function used by all services
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables
 * @returns {Object} Authentication result
 */
export async function authenticateRequest(request, env) {
  try {
    // Extract session token using standard priority order
    const sessionToken = extractSessionToken(request);
    
    if (!sessionToken) {
      return createAuthError('AUTH_REQUIRED', 'No session token provided');
    }

    // Validate session with central auth service
    const validationResult = await validateWithAuthService(sessionToken, env);
    
    if (!validationResult.success) {
      return validationResult;
    }

    // Return standardized success response
    return {
      success: true,
      user: validationResult.user,
      session: validationResult.session,
      permissions: validationResult.permissions || []
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return createAuthError('AUTH_SYSTEM_ERROR', 'Authentication system unavailable');
  }
}

/**
 * Extract session token from request using standard priority order
 * @param {Request} request 
 * @returns {string|null} Session token or null
 */
function extractSessionToken(request) {
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
  
  // Priority 3: Query parameter (for webhooks/special cases only)
  const url = new URL(request.url);
  const tokenParam = url.searchParams.get('token');
  if (tokenParam) {
    return tokenParam;
  }
  
  return null;
}

/**
 * Validate session token with central auth service
 * @param {string} sessionToken 
 * @param {Object} env 
 * @returns {Object} Validation result
 */
async function validateWithAuthService(sessionToken, env) {
  const authServiceUrl = env.AUTH_SERVICE_URL;
  const serviceName = env.SERVICE_NAME || 'unknown-service';
  
  if (!authServiceUrl) {
    console.error('AUTH_SERVICE_URL not configured');
    return createAuthError('AUTH_CONFIG_ERROR', 'Authentication service not configured');
  }

  try {
    const response = await fetch(`${authServiceUrl}/api/v1/auth/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`,
        'User-Agent': `tamyla-service/${serviceName}`
      },
      body: JSON.stringify({
        session_token: sessionToken,
        service: serviceName,
        timestamp: Date.now()
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      console.error(`Auth service validation failed: ${response.status} - ${errorText}`);
      
      if (response.status === 401) {
        return createAuthError('INVALID_SESSION', 'Session expired or invalid');
      } else if (response.status === 403) {
        return createAuthError('FORBIDDEN', 'Access denied for this service');
      } else {
        return createAuthError('AUTH_SERVICE_ERROR', 'Authentication service error');
      }
    }

    const result = await response.json();
    
    if (!result.success) {
      return createAuthError('VALIDATION_FAILED', result.error || 'Session validation failed');
    }

    // Validate required fields
    if (!result.user || !result.user.id) {
      return createAuthError('INVALID_RESPONSE', 'Invalid user data from auth service');
    }

    return result;

  } catch (error) {
    console.error('Error communicating with auth service:', error);
    return createAuthError('AUTH_SERVICE_UNAVAILABLE', 'Authentication service unavailable');
  }
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
    timestamp: new Date().toISOString()
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
export function createAuthenticatedResponse(data, env, request, status = 200) {
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
    'https://trading.tamyla.com'
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
