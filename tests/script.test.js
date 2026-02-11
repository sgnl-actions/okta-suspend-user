import { jest } from '@jest/globals';
import script from '../src/script.mjs';
import { SGNL_USER_AGENT } from '@sgnl-actions/utils';

// Mock fetch globally
global.fetch = jest.fn();

describe('Okta Suspend User Action', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('invoke handler', () => {
    test('should successfully suspend user with valid inputs', async () => {
      const params = {
        userId: 'user123',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token-123'
        }
      };

      // Mock GET user response - user is ACTIVE
      const mockGetUserData = {
        id: 'user123',
        status: 'ACTIVE',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        }
      };

      // Mock POST suspend response
      const mockSuspendUserData = {
        id: 'user123',
        status: 'SUSPENDED',
        profile: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com'
        },
        statusChanged: '2024-01-15T10:30:00.000Z'
      };

      // First call: POST suspend
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuspendUserData
      });

      // Second call: GET user to verify
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSuspendUserData
      });

      const result = await script.invoke(params, context);

      expect(result).toEqual({
        userId: 'user123',
        suspended: true,
        address: 'https://example.okta.com',
        suspendedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        status: 'SUSPENDED'
      });

      // Should have called POST suspend first
      expect(fetch).toHaveBeenNthCalledWith(1,
        'https://example.okta.com/api/v1/users/user123/lifecycle/suspend',
        {
          method: 'POST',
          headers: {
            'Authorization': 'SSWS test-token-123',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "User-Agent": SGNL_USER_AGENT,
          }
        }
      );

      // Then called GET to verify
      expect(fetch).toHaveBeenNthCalledWith(2,
        'https://example.okta.com/api/v1/users/user123',
        {
          method: 'GET',
          headers: {
            'Authorization': 'SSWS test-token-123',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            "User-Agent": SGNL_USER_AGENT,
          }
        }
      );
    });

    test('should add SSWS prefix to token if missing', async () => {
      const params = {
        userId: 'user456',
        address: 'https://test.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'token-without-prefix'
        }
      };

      // Mock POST suspend
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED', statusChanged: '2024-01-15T10:30:00.000Z' })
      });

      // Mock GET user to verify
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED', statusChanged: '2024-01-15T10:30:00.000Z' })
      });

      await script.invoke(params, context);

      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'SSWS token-without-prefix'
          })
        })
      );
    });

    test('should encode userId to prevent injection', async () => {
      const params = {
        userId: 'user@test.com/../../admin',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock POST suspend
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED', statusChanged: '2024-01-15T10:30:00.000Z' })
      });

      // Mock GET user to verify
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED', statusChanged: '2024-01-15T10:30:00.000Z' })
      });

      await script.invoke(params, context);

      // Check that the POST URL is properly encoded
      expect(fetch).toHaveBeenNthCalledWith(1,
        'https://example.okta.com/api/v1/users/user%40test.com%2F..%2F..%2Fadmin/lifecycle/suspend',
        expect.any(Object)
      );

      // Check that the GET URL is properly encoded
      expect(fetch).toHaveBeenNthCalledWith(2,
        'https://example.okta.com/api/v1/users/user%40test.com%2F..%2F..%2Fadmin',
        expect.any(Object)
      );
    });

    test('should throw error when API token is missing', async () => {
      const params = {
        userId: 'user789',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {}
      };

      await expect(script.invoke(params, context)).rejects.toThrow(
        'No authentication configured'
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    test('should throw error when address is missing', async () => {
      const params = {
        userId: 'user123'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      await expect(script.invoke(params, context)).rejects.toThrow(
        'No URL specified. Provide address parameter or ADDRESS environment variable'
      );

      expect(fetch).not.toHaveBeenCalled();
    });

    test('should handle API error responses when suspending user', async () => {
      const params = {
        userId: 'invalid-user',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock 404 Not Found response for POST suspend
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          errorCode: 'E0000007',
          errorSummary: 'Not found: Resource not found: invalid-user (User)'
        })
      });

      const error = await script.invoke(params, context).catch(e => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Not found: Resource not found: invalid-user (User)');
      expect(error.statusCode).toBe(404);
    });

    test('should handle permission error when suspending user', async () => {
      const params = {
        userId: 'user123',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock 403 Forbidden response for POST suspend
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          errorCode: 'E0000006',
          errorSummary: 'You do not have permission to perform the requested action'
        })
      });

      const error = await script.invoke(params, context).catch(e => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('You do not have permission');
      expect(error.statusCode).toBe(403);
    });

    test('should succeed even if suspend returns no JSON body', async () => {
      const params = {
        userId: 'user123',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock success POST suspend response without JSON body
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Invalid JSON');
        }
      });

      // Mock GET user to verify - should be SUSPENDED now
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED', statusChanged: '2024-01-15T10:30:00.000Z' })
      });

      const result = await script.invoke(params, context);

      expect(result).toEqual({
        userId: 'user123',
        suspended: true,
        address: 'https://example.okta.com',
        suspendedAt: '2024-01-15T10:30:00.000Z',
        status: 'SUSPENDED'
      });
    });

    test('should handle user already suspended', async () => {
      const params = {
        userId: 'suspended-user',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock POST suspend - returns 400 because already suspended
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errorCode: 'E0000001',
          errorSummary: 'Cannot suspend a user with a status of SUSPENDED'
        })
      });

      // Mock GET user - confirms already SUSPENDED
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUSPENDED',
          statusChanged: '2024-01-15T10:30:00.000Z'
        })
      });

      const result = await script.invoke(params, context);

      expect(result).toEqual({
        userId: 'suspended-user',
        suspended: true,
        address: 'https://example.okta.com',
        suspendedAt: '2024-01-15T10:30:00.000Z',
        status: 'SUSPENDED'
      });

      // Should call both POST and GET
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should throw error if user cannot be suspended', async () => {
      const params = {
        userId: 'deprovisioned-user',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock POST suspend - returns 400 because user is DEPROVISIONED
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errorCode: 'E0000001',
          errorSummary: 'Cannot suspend a user with a status of DEPROVISIONED'
        })
      });

      // Mock GET user - DEPROVISIONED
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'DEPROVISIONED' })
      });

      const error = await script.invoke(params, context).catch(e => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('could not be suspended');
      expect(error.message).toContain('DEPROVISIONED');
      expect(error.statusCode).toBe(400);

      // Should call both POST and GET
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should handle invalid JSON in GET user response', async () => {
      const params = {
        userId: 'user123',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock POST suspend - success
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ status: 'SUSPENDED' })
      });

      // Mock GET user with invalid JSON
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        }
      });

      const error = await script.invoke(params, context).catch(e => e);

      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Cannot parse user data');
      expect(error.statusCode).toBe(500);

      // Should call both POST and GET
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    test('should handle suspended user with null statusChanged', async () => {
      const params = {
        userId: 'suspended-user',
        address: 'https://example.okta.com'
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      // Mock POST suspend - returns 400 because already suspended
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          errorCode: 'E0000001',
          errorSummary: 'Cannot suspend a user with a status of SUSPENDED'
        })
      });

      // Mock GET user - SUSPENDED with null statusChanged
      fetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          status: 'SUSPENDED',
          statusChanged: null,
          lastUpdated: '2024-01-15T10:30:00.000Z'
        })
      });

      const result = await script.invoke(params, context);

      expect(result).toEqual({
        userId: 'suspended-user',
        suspended: true,
        address: 'https://example.okta.com',
        suspendedAt: '2024-01-15T10:30:00.000Z',
        status: 'SUSPENDED'
      });

      // Should call both POST and GET
      expect(fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handler', () => {
    test('should re-throw error for framework to handle', async () => {
      const testError = new Error('Failed to suspend user: HTTP 429');
      testError.statusCode = 429;

      const params = {
        userId: 'user123',
        address: 'https://example.okta.com',
        error: testError
      };

      const context = {
        secrets: {
          BEARER_AUTH_TOKEN: 'SSWS test-token'
        }
      };

      await expect(script.error(params, context)).rejects.toThrow(testError);
      expect(fetch).not.toHaveBeenCalled();
    });

    test('should log error details', async () => {
      const consoleSpy = jest.spyOn(console, 'error');
      const testError = new Error('Service unavailable');
      testError.statusCode = 503;

      const params = {
        userId: 'user456',
        address: 'https://test.okta.com',
        error: testError
      };

      const context = {};

      try {
        await script.error(params, context);
      } catch {
        // Expected to throw
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        'User suspension failed for user user456: Service unavailable'
      );
    });
  });

  describe('halt handler', () => {
    test('should handle graceful shutdown', async () => {
      const params = {
        userId: 'user123',
        reason: 'timeout'
      };

      const context = {};

      const result = await script.halt(params, context);

      expect(result).toEqual({
        userId: 'user123',
        reason: 'timeout',
        haltedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        cleanupCompleted: true
      });
    });

    test('should handle halt with missing userId', async () => {
      const params = {
        reason: 'cancelled'
      };

      const context = {};

      const result = await script.halt(params, context);

      expect(result).toEqual({
        userId: 'unknown',
        reason: 'cancelled',
        haltedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        cleanupCompleted: true
      });
    });
  });
});