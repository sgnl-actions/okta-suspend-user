/**
 * Okta Suspend User Action
 *
 * Suspends an Okta user account, preventing them from logging in.
 * The user remains in the system but cannot authenticate until unsuspended.
 */

/**
 * Helper function to perform user suspension
 * @private
 */
async function suspendUser(userId, oktaDomain, authToken) {
  // Safely encode userId to prevent injection
  const encodedUserId = encodeURIComponent(userId);
  const url = new URL(`/api/v1/users/${encodedUserId}/lifecycle/suspend`, `https://${oktaDomain}`);

  const authHeader = authToken.startsWith('SSWS ') ? authToken : `SSWS ${authToken}`;

  const response = await fetch(url.toString(), {
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
   * @param {string} params.oktaDomain - The Okta domain (e.g., example.okta.com)
   * @param {Object} context - Execution context with env, secrets, outputs
   * @returns {Object} Job results
   */
  invoke: async (params, context) => {
    const { userId, oktaDomain } = params;

    console.log(`Starting Okta user suspension for user: ${userId}`);

    // Validate inputs
    if (!userId || typeof userId !== 'string') {
      throw new Error('Invalid or missing userId parameter');
    }
    if (!oktaDomain || typeof oktaDomain !== 'string') {
      throw new Error('Invalid or missing oktaDomain parameter');
    }

    // Validate Okta API token is present
    if (!context.secrets?.OKTA_API_TOKEN) {
      throw new Error('Missing required secret: OKTA_API_TOKEN');
    }

    // Make the API request to suspend the user
    const response = await suspendUser(
      userId,
      oktaDomain,
      context.secrets.OKTA_API_TOKEN
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
        oktaDomain: oktaDomain,
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