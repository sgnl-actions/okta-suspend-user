/**
 * Okta Suspend User Action
 *
 * Suspends an Okta user account, preventing them from logging in.
 * The user remains in the system but cannot authenticate until unsuspended.
 */

import { getBaseURL, getAuthorizationHeader, resolveJSONPathTemplates} from '@sgnl-actions/utils';

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


export default {
  /**
   * Main execution handler - suspends the specified Okta user
   * @param {Object} params - Job input parameters
   * @param {string} params.userId - The Okta user ID
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
    const jobContext = context.data || {};

    // Resolve JSONPath templates in params
    const { result: resolvedParams, errors } = resolveJSONPathTemplates(params, jobContext);
    if (errors.length > 0) {
      console.warn('Template resolution errors:', errors);
    }

    const { userId } = resolvedParams;

    console.log(`Starting Okta user suspension for user: ${userId}`);

    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing userId parameter');
    }

    // Get base URL using utility function
    const baseUrl = getBaseURL(resolvedParams, context);

    // Get authorization header
    let authHeader = await getAuthorizationHeader(context);

    // Handle Okta's SSWS token format for Bearer auth mode
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      authHeader = token.startsWith('SSWS ') ? token : `SSWS ${token}`;
    }

    // Make the API request to suspend the user
    const response = await suspendUser(
      userId,
      baseUrl,
      authHeader
    );

    // Handle the response
    if (response.ok) {
      // 200 OK is the expected success response
      console.log(`Successfully suspended user ${userId}`);

      // Parse the response to get user details
      let userData = {};
      try {
        userData = await response.json();
      } catch {
        // Response might not have JSON body
      }

      return {
        userId: userId,
        suspended: true,
        address: baseUrl,
        suspendedAt: new Date().toISOString(),
        status: userData.status || 'SUSPENDED'
      };
    }

    // Handle error responses
    const statusCode = response.status;
    let errorMessage = `Failed to suspend user: HTTP ${statusCode}`;

    try {
      const errorBody = await response.json();
      if (errorBody.errorSummary) {
        errorMessage = `Failed to suspend user: ${errorBody.errorSummary}`;
      }
      console.error('Okta API error response:', errorBody);
    } catch {
      // Response might not be JSON
      console.error('Failed to parse error response');
    }

    // Throw error with status code for proper error handling
    const error = new Error(errorMessage);
    error.statusCode = statusCode;
    throw error;
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