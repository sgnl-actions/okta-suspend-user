# Okta Suspend User Action

Suspend an Okta user account, preventing them from logging in. The user remains in the system but cannot authenticate until unsuspended.

## Overview

This SGNL action integrates with Okta to suspend a user account. When executed, the user will be unable to log in to any Okta applications until their account is unsuspended.

## Prerequisites

- Okta instance
- API authentication credentials (supports 4 auth methods - see Configuration below)
- Okta API access with permissions to manage user lifecycle

## Configuration

### Authentication

This action supports four authentication methods. Configure one of the following:

#### Option 1: Bearer Token (Okta API Token)
| Secret | Description |
|--------|-------------|
| `BEARER_AUTH_TOKEN` | Okta API token (SSWS format) |

#### Option 2: Basic Authentication
| Secret | Description |
|--------|-------------|
| `BASIC_USERNAME` | Username for Okta authentication |
| `BASIC_PASSWORD` | Password for Okta authentication |

#### Option 3: OAuth2 Client Credentials
| Secret/Environment | Description |
|-------------------|-------------|
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_SECRET` | OAuth2 client secret |
| `OAUTH2_CLIENT_CREDENTIALS_CLIENT_ID` | OAuth2 client ID |
| `OAUTH2_CLIENT_CREDENTIALS_TOKEN_URL` | OAuth2 token endpoint URL |
| `OAUTH2_CLIENT_CREDENTIALS_SCOPE` | OAuth2 scope (optional) |
| `OAUTH2_CLIENT_CREDENTIALS_AUDIENCE` | OAuth2 audience (optional) |
| `OAUTH2_CLIENT_CREDENTIALS_AUTH_STYLE` | OAuth2 auth style (optional) |

#### Option 4: OAuth2 Authorization Code
| Secret | Description |
|--------|-------------|
| `OAUTH2_AUTHORIZATION_CODE_ACCESS_TOKEN` | OAuth2 access token |

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `ADDRESS` | Okta API base URL | `https://dev-12345.okta.com` |

### Input Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `userId` | string | Yes | The Okta user ID | `00u1234567890abcdef` |

### Output Structure

| Field | Type | Description |
|-------|------|-------------|
| `userId` | string | The user ID that was suspended |
| `suspended` | boolean | Whether the suspension was successful |
| `address` | string | The Okta API base URL used |
| `suspendedAt` | datetime | When the operation completed (ISO 8601) |
| `status` | string | User status after suspension (SUSPENDED) |

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
    "userId": "00u1234567890abcdef"
  },
  "environment": {
    "ADDRESS": "https://dev-12345.okta.com",
    "LOG_LEVEL": "info"
  }
}
```

### Successful Response

```json
{
  "userId": "00u1234567890abcdef",
  "suspended": true,
  "address": "https://dev-12345.okta.com",
  "suspendedAt": "2024-01-15T10:30:00Z",
  "status": "SUSPENDED"
}
```

## How It Works

The action performs a POST request to the Okta API to suspend the user:

1. **Validate Input**: Ensures userId parameter is provided
2. **Authenticate**: Uses configured authentication method to get authorization
3. **Suspend User**: Makes POST request to `/api/v1/users/{userId}/lifecycle/suspend`
4. **Return Result**: Confirms user was suspended

## Error Handling

The action includes error handling for common scenarios:

### HTTP Status Codes
- **200 OK**: Successful suspension (expected response)
- **400 Bad Request**: User already suspended or invalid state transition
- **401 Unauthorized**: Invalid authentication credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: User not found
- **429 Rate Limit**: Too many requests

## Development

### Local Testing

```bash
# Install dependencies
npm install

# Run tests
npm test

# Test locally with mock data
npm run dev

# Build for production
npm run build
```

### Running Tests

The action includes comprehensive unit tests covering:
- Input validation (userId parameter)
- Authentication handling (all 4 auth methods)
- Success scenarios
- Error handling (API errors, missing credentials, already suspended users)

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check test coverage
npm run test:coverage
```

## Security Considerations

- **Credential Protection**: Never log or expose authentication credentials
- **User Impact**: Suspending a user immediately prevents login
- **Audit Logging**: All operations are logged with timestamps
- **Input Validation**: User IDs are validated and URL-encoded

## Okta API Reference

This action uses the following Okta API endpoint:
- [Suspend User](https://developer.okta.com/docs/reference/api/users/#suspend-user) - POST `/api/v1/users/{userId}/lifecycle/suspend`

## Troubleshooting

### Common Issues

1. **"Invalid or missing userId parameter"**
   - Ensure the `userId` parameter is provided and is a non-empty string
   - Verify the user ID exists in your Okta instance

2. **"No authentication configured"**
   - Ensure you have configured one of the four supported authentication methods
   - Check that the required secrets/environment variables are set

3. **"Failed to suspend user: HTTP 400"**
   - User may already be suspended
   - Check the user's current status in Okta admin console

4. **"Failed to suspend user: HTTP 404"**
   - Verify the user ID is correct
   - Check that the user exists in Okta

5. **"Failed to suspend user: HTTP 403"**
   - Ensure your API credentials have permission to manage user lifecycle
   - Check Okta admin console for required permissions

## Version History

### v1.0.0
- Initial release
- Support for suspending users via Okta API
- Four authentication methods (Bearer, Basic, OAuth2 Client Credentials, OAuth2 Authorization Code)
- Integration with @sgnl-actions/utils package
- Comprehensive error handling

## License

MIT

## Support

For issues or questions, please contact SGNL Engineering or create an issue in this repository.
