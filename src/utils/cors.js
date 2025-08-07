/**
 * CORS Utilities
 * Centralized CORS header management for security
 */

export const getCorsHeaders = (env, request) => {
  const allowedOrigins = env.CORS_ORIGINS?.split(',') || [
    'https://tamyla.com',
    'https://www.tamyla.com',
    'https://trading.tamyla.com'
  ];
  
  // Get the origin from the request
  const requestOrigin = request?.headers?.get('Origin');
  
  // Check if origin is allowed
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
};
