/**
 * Okta Suspend User Action
 *
 * Suspends an Okta user account, preventing them from logging in.
 * The user remains in the system but cannot authenticate until unsuspended.
 */

import { getBaseURL, getAuthorizationHeader } from '@sgnl-actions/utils';

// Okta user status constants
const USER_STATUS = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED'
};

/**
 * Helper function to perform user suspension
 * @private
 */
async function suspendUser(userId, baseUrl, authHeader) {
  // Safely encode userId to prevent injection
  const encodedUserId = encodeURIComponent(userId);

  // Build URL using base URL (already cleaned by getBaseUrl)
  const url = `${baseUrl}/api/v1/users/${encodedUserId}/lifecycle/suspend`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    }
  });

  return response;
}

/**
 * Helper function to get user details
 * @private
 */
async function getUser(userId, baseUrl, authHeader) {
  // Safely encode userId to prevent injection
  const encodedUserId = encodeURIComponent(userId);

  // Build URL using base URL (already cleaned by getBaseUrl)
  const url = `${baseUrl}/api/v1/users/${encodedUserId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': authHeader,
      'Accept': 'application/json',
    }
  });

  return response;
}

/**
 * Helper function to create an error with a status code
 * @private
 */
function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export default {
  /**
   * Main execution handler - suspends the specified Okta user
   * @param {Object} params - Job input parameters
   * @param {string} params.userId - The Okta user ID
   * @param {string} params.address - Full URL to Okta API (defaults to ADDRESS environment variable)
   *
   * @param {Object} context - Execution context with secrets and environment
   * @param {string} context.environment.ADDRESS - Okta API base URL
   *
   * The configured auth type will determine which of the following environment variables and secrets are available
   * @param {string} context.secrets.BEARER_AUTH_TOKEN
   *
   * @param {string} context.secrets.BASIC_USERNAME
   * @param {string} context.secrets.BASIC_PASSWORD
   *
   * @param {string} context.secrets.OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUDIENCE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_SCOPE
   * @param {string} context.environment.OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL
   *
   * @param {string} context.secrets.OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN
   *
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    const { userId } = params;

    console.log(`Starting Okta user suspension for user: ${userId}`);

    // Get base URL using utility function
    const baseUrl = getBaseURL(params, context);

    // Get authorization header
    let authHeader = await getAuthorizationHeader(context);

    // Handle Okta's SSWS token format - only for Bearer token auth mode
    if (context.secrets.BEARER_AUTH_TOKEN && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      authHeader = token.startsWith('SSWS ') ? token : `SSWS ${token}`;
    }

    const getUserResponse = await getUser(userId, baseUrl, authHeader);

    if (!getUserResponse.ok) {
      const errorMessage = `Cannot fetch information about User: HTTP ${getUserResponse.status}`;
      console.error(errorMessage);
      throw createError(errorMessage, getUserResponse.status);
    }

    let userData;
    try {
      userData = await getUserResponse.json();
    } catch (err) {
      const errorMessage = `Cannot parse user data: ${err.message}`;
      console.error(errorMessage);
      throw createError(errorMessage, 500);
    }

    // Check if user is already suspended
    if (userData.status === USER_STATUS.SUSPENDED) {
      return {
        userId,
        suspended: true,
        address: baseUrl,
        suspendedAt: userData.statusChanged || new Date().toISOString(),
        status: userData.status
      };
    }

    // Verify user is in ACTIVE state
    if (userData.status !== USER_STATUS.ACTIVE) {
      const errorMessage = `User must have an ACTIVE status to be suspended. User is ${userData.status}`;
      console.error(errorMessage);
      throw createError(errorMessage, 400);
    }

    // Make the API request to suspend the user
    const suspendUserResponse = await suspendUser(userId, baseUrl, authHeader);

    if (!suspendUserResponse.ok) {
      // Handle error responses
      let errorMessage = `Failed to suspend user: HTTP ${suspendUserResponse.status}`;

      try {
        const errorBody = await suspendUserResponse.json();
        if (errorBody.errorSummary) {
          errorMessage = `Failed to suspend user: ${errorBody.errorSummary}`;
        }
        console.error('Okta API error response:', errorBody);
      } catch {
        // Response might not be JSON
        console.error('Failed to parse error response');
      }

      throw createError(errorMessage, suspendUserResponse.status);
    }

    // Successfully suspended user
    console.log(`Successfully suspended user ${userId}`);

    // Parse the response to get updated user details
    let suspendedUserData = {};
    try {
      suspendedUserData = await suspendUserResponse.json();
    } catch {
      // Response might not have JSON body, use defaults
    }

    return {
      userId,
      suspended: true,
      address: baseUrl,
      suspendedAt: new Date().toISOString(),
      status: suspendedUserData.status || USER_STATUS.SUSPENDED
    };
  },

  /**
   * Error recovery handler - framework handles retries by default
   * Only implement if custom recovery logic is needed
   * @param {Object} params - Original params plus error information
   * @param {Object} context - Execution context
   * @returns {Object} Recovery results
   */
  error: async (params, _context) => {
    const { error, userId } = params;
    console.error(`User suspension failed for user ${userId}: ${error.message}`);

    // Framework handles retries for transient errors (429, 502, 503, 504)
    // Just re-throw the error to let the framework handle it
    throw error;
  },

  /**
   * Graceful shutdown handler - cleanup when job is halted
   * @param {Object} params - Original params plus halt reason
   * @param {Object} context - Execution context
   * @returns {Object} Cleanup results
   */
  halt: async (params, _context) => {
    const { reason, userId } = params;
    console.log(`User suspension job is being halted (${reason}) for user ${userId}`);

    // No cleanup needed for this simple operation
    // The POST request either completed or didn't

    return {
      userId: userId || 'unknown',
      reason: reason,
      haltedAt: new Date().toISOString(),
      cleanupCompleted: true
    };
  }
};