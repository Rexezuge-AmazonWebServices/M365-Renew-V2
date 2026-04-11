import { APIGatewayProxyHandler, ScheduledHandler } from 'aws-lambda';
import { router } from './api/router.js';
import { processUsers } from './scheduler/processUsers.js';

export const api: APIGatewayProxyHandler = async (event, context) => {
  return router(event, context);
};

export const scheduler: ScheduledHandler = async (event, context) => {
  await processUsers(event, context);
};
