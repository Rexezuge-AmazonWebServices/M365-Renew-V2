export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'M365 Renew API',
    version: '1.0.0',
    description: 'API for managing Microsoft 365 credential renewal automation'
  },
  paths: {
    '/api/admin/generate-key': {
      post: {
        tags: ['Admin'],
        summary: 'Generate encryption key',
        responses: {
          '200': {
            description: 'Key generated successfully',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: { type: 'string' },
                    key: { type: 'string' }
                  }
                }
              }
            }
          }
        }
      }
    },
    '/api/credentials/store': {
      post: {
        tags: ['Credentials'],
        summary: 'Store user credentials',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  email_address: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  totp_key: { type: 'string' }
                },
                required: ['email_address', 'password', 'totp_key']
              }
            }
          }
        },
        responses: {
          '200': { description: 'Credentials stored successfully' }
        }
      }
    },
    '/api/internal/credentials/{userId}': {
      get: {
        tags: ['Internal'],
        summary: 'Get user credentials',
        parameters: [
          {
            name: 'userId',
            in: 'path',
            required: true,
            schema: { type: 'string' }
          }
        ],
        responses: {
          '200': { description: 'Credentials retrieved successfully' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        tags: ['Authentication'],
        summary: 'M365 Login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  userId: { type: 'string' }
                },
                required: ['userId']
              }
            }
          }
        },
        responses: {
          '200': { description: 'Login attempt completed' }
        }
      }
    }
  }
};
