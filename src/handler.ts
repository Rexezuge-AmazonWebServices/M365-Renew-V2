import { APIGatewayProxyHandler, ScheduledHandler } from 'aws-lambda';
import { router } from './api/router';
import { processUsers } from './scheduler/processUsers';

export const api: APIGatewayProxyHandler = async (event, context) => {
  return router(event, context);
};

export const scheduler: ScheduledHandler = async (event, context) => {
  await processUsers(event, context);
};
