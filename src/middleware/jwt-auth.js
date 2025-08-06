/**
 * JWT-based Authentication Middleware for Tamyla Platform
 * Validates JWT tokens locally without calling auth service
 * High-performance alternative to session-based auth
 */

/**
 * Main JWT authentication function
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment variables (must include JWT_SECRET)
 * @returns {Object} Authentication result
 */
export async function authenticateJWT(request, env) {
  try {
    // Extract token using standard priority order
    const token = extractToken(request);
    
    if (!token) {
      return createAuthError('AUTH_REQUIRED', 'No JWT token provided');
    }

    // Validate JWT locally (no auth service call needed!)
    const payload = await verifyJWT(token, env.JWT_SECRET);
    
    if (!payload) {
      return createAuthError('INVALID_TOKEN', 'JWT token is invalid');
    }

    // Check token expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return createAuthError('TOKEN_EXPIRED', 'JWT token has expired');
    }

    // Extract user information from token payload
    const user = payload.user || {
      id: payload.sub || payload.userId,
      email: payload.email,
      name: payload.name
    };

    // Return standardized success response
    return {
      success: true,
      user: user,
      permissions: payload.permissions || [],
      sessionId: payload.session_id,
      source: 'jwt-local',
      expiresAt: payload.exp ? new Date(payload.exp * 1000) : null
    };

  } catch (error) {
    console.error('JWT Authentication error:', error);
    return createAuthError('AUTH_SYSTEM_ERROR', 'JWT validation failed');
  }
}

/**
 * Extract JWT token from request using standard priority order
 * @param {Request} request 
 * @returns {string|null} JWT token or null
 */
function extractToken(request) {
  // Priority 1: Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  
  // Priority 2: Cookie (session_token or jwt_token)
  const cookieHeader = request.headers.get('Cookie');
  if (cookieHeader) {
    const cookies = parseCookies(cookieHeader);
    return cookies.session_token || cookies.jwt_token || cookies.token;
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
 * Verify JWT token using Web Crypto API
 * @param {string} token - JWT token to verify
 * @param {string} secret - Secret key for verification
 * @returns {Object|null} Decoded payload or null if invalid
 */
async function verifyJWT(token, secret) {
  if (!secret) {
    throw new Error('JWT_SECRET not configured in environment variables');
  }

  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    const [headerB64, payloadB64, signatureB64] = parts;
    
    // Decode header and payload
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/')));
    const payload = JSON.parse(atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/')));
    
    // Verify signature
    const signatureData = `${headerB64}.${payloadB64}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signature = base64UrlDecode(signatureB64);
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      new TextEncoder().encode(signatureData)
    );
    
    if (!isValid) {
      throw new Error('Invalid JWT signature');
    }
    
    return payload;
    
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Base64 URL decode
 * @param {string} base64Url 
 * @returns {ArrayBuffer}
 */
function base64UrlDecode(base64Url) {
  const padding = '='.repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
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
    source: 'jwt-local'
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
export function createJWTResponse(data, env, request, status = 200) {
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
