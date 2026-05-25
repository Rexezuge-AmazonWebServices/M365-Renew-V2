export const swaggerSpec = {
  openapi: '3.0.0',
  info: {
    title: 'M365 Renew API',
    version: '1.0.0',
    description: 'API for managing Microsoft 365 credential renewal automation',
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
                    key: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
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
                  totp_key: { type: 'string' },
                },
                required: ['email_address', 'password', 'totp_key'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Credentials stored successfully' },
        },
      },
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
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': { description: 'Credentials retrieved successfully' },
        },
      },
    },
    '/api/internal/processing-logs/{logId}': {
      get: {
        tags: ['Internal'],
        summary: 'Get processing log detail',
        description: 'Returns an HTML detail page for a processing log and renders the stored error screenshot when available.',
        parameters: [
          {
            name: 'logId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Processing log detail page',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
          '404': { description: 'Log not found' },
        },
      },
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
                  email_address: { type: 'string', format: 'email' },
                  password: { type: 'string' },
                  totp_key: { type: 'string' },
                },
                required: ['email_address', 'password', 'totp_key'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Login attempt completed' },
        },
      },
    },
  },
};
