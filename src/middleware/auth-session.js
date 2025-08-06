/**
 * Session-based Authentication Middleware
 * Validates session tokens with the auth service
 * Based on the agreed session exchange flow
 */

export async function authenticate(request, env) {
  try {
    // Look for session token in Authorization header or cookies
    let sessionToken = null;
    
    // Check Authorization header first (Bearer format)
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      sessionToken = authHeader.substring(7);
    }
    
    // Fallback to cookies
    if (!sessionToken) {
      const cookieHeader = request.headers.get('Cookie');
      if (cookieHeader) {
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
          const [key, value] = cookie.trim().split('=');
          acc[key] = value;
          return acc;
        }, {});
        sessionToken = cookies.session_token || cookies.sessionToken;
      }
    }
    
    if (!sessionToken) {
      return {
        success: false,
        error: 'No session token provided'
      };
    }

    // Validate session with auth service
    const authServiceUrl = env.AUTH_SERVICE_URL;
    
    if (!authServiceUrl) {
      console.error('AUTH_SERVICE_URL not configured');
      return {
        success: false,
        error: 'Authentication service not configured'
      };
    }

    try {
      // Call auth service to validate session
      const validationResponse = await fetch(`${authServiceUrl}/api/v1/auth/validate-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${sessionToken}`
        },
        body: JSON.stringify({ 
          session_token: sessionToken,
          service: 'content-store-service'
        })
      });

      if (!validationResponse.ok) {
        const errorText = await validationResponse.text();
        console.error('Session validation failed:', validationResponse.status, errorText);
        return {
          success: false,
          error: 'Invalid session'
        };
      }

      const validationResult = await validationResponse.json();
      
      if (!validationResult.success || !validationResult.user) {
        return {
          success: false,
          error: 'Session validation failed'
        };
      }

      // Return success with user info from auth service
      return {
        success: true,
        user: validationResult.user,
        session: validationResult.session
      };
      
    } catch (error) {
      console.error('Error validating session with auth service:', error);
      return {
        success: false,
        error: 'Authentication service unavailable'
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
