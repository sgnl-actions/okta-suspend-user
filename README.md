# Okta Suspend User Action

Suspend an Okta user account, preventing them from logging in. The user remains in the system but cannot authenticate until unsuspended.

## Overview

This SGNL action integrates with Okta's REST API to suspend a user account. When executed, the user's status changes to SUSPENDED and they are immediately prevented from logging into any Okta-protected applications.

## Prerequisites

- Okta API Token with appropriate permissions to manage users
- Okta domain (e.g., `example.okta.com`)
- Target user's Okta user ID

## Configuration

### Required Secrets

- `OKTA_API_TOKEN` - Your Okta API token (can be prefixed with "SSWS " or provided without prefix)

### Optional Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `RATE_LIMIT_BACKOFF_MS` | `30000` | Wait time after rate limit (429) errors |
| `SERVICE_ERROR_BACKOFF_MS` | `10000` | Wait time after service errors (502/503/504) |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `userId` | string | Yes | The Okta user ID to suspend | `00u1a2b3c4d5e6f7g8h9` |
| `oktaDomain` | string | Yes | Your Okta domain | `example.okta.com` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | The user ID that was suspended |
| `suspended` | boolean | Whether the user was successfully suspended |
| `oktaDomain` | string | The Okta domain where the action was performed |
| `suspendedAt` | datetime | When the user was suspended (ISO 8601) |
| `status` | string | The user's status after suspension (typically "SUSPENDED") |

## Usage Example

### Job Request

```json
{
  "id": "suspend-user-001",
  "type": "nodejs-22",
  "script": {
    "repository": "github.com/sgnl-actions/okta-suspend-user",
    "version": "v1.0.0",
    "type": "nodejs"
  },
  "script_inputs": {
    "userId": "00u1a2b3c4d5e6f7g8h9",
    "oktaDomain": "example.okta.com"
  },
  "environment": {
    "LOG_LEVEL": "info"
  }
}
```

### Successful Response

```json
{
  "userId": "00u1a2b3c4d5e6f7g8h9",
  "suspended": true,
  "oktaDomain": "example.okta.com",
  "suspendedAt": "2024-01-15T10:30:00Z",
  "status": "SUSPENDED"
}
```

## Error Handling

The action includes automatic retry logic for common transient errors:

### Retryable Errors
- **429 Rate Limit**: Waits 30 seconds before retrying
- **502/503/504 Service Issues**: Waits 10 seconds before retrying

### Non-Retryable Errors
- **401 Unauthorized**: Invalid API token
- **404 Not Found**: User doesn't exist
- **400 Bad Request**: User is already suspended or invalid request

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev -- --params '{"userId": "test123", "oktaDomain": "dev.okta.com"}'

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Successful user suspension
- API token validation
- Error response handling
- Retry logic for rate limiting
- Service interruption recovery
- URL encoding for security

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

## Security Considerations

- **API Token Protection**: Never log or expose the Okta API token
- **Audit Logging**: All user suspensions are logged with timestamps
- **URL Encoding**: User IDs are properly encoded to prevent injection attacks
- **Idempotent Operations**: Safe to retry if network issues occur

## Important Notes

### User Impact
- Suspended users cannot log in to any Okta-protected applications
- Active sessions are NOT automatically terminated (use okta-revoke-session action for that)
- Users remain in the system and can be unsuspended later
- All user data and group memberships are preserved

### Common Use Cases
- Security incidents requiring immediate access revocation
- Employee termination workflows
- Temporary access restrictions during investigations
- Compliance-driven access management

## Okta API Reference

This action uses the following Okta API endpoint:
- [Suspend User](https://developer.okta.com/docs/reference/api/users/#suspend-user)

## Troubleshooting

### Common Issues

1. **"Missing required secret: OKTA_API_TOKEN"**
   - Ensure the `OKTA_API_TOKEN` secret is configured in your SGNL environment

2. **"Not found: Resource not found"**
   - Verify the user ID exists in your Okta organization
   - Check that the user ID format is correct

3. **"Invalid API token"**
   - Confirm your API token has the necessary permissions
   - Verify the token hasn't expired

4. **"User is already suspended"**
   - The user is already in a suspended state
   - This is typically not an error condition

5. **Rate Limiting**
   - The action automatically handles rate limits with backoff
   - Consider batching operations if suspending many users

## Version History

### v1.0.0
- Initial release
- Support for user suspension via Okta API
- Automatic retry logic for transient errors
- Comprehensive error handling and logging
- URL encoding for security

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.