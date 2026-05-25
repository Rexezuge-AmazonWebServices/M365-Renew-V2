import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { ProcessingLogDAO } from '../../dao/ProcessingLogDAO.js';

export const getProcessingLog = async (event: APIGatewayProxyEvent, _context: Context): Promise<APIGatewayProxyResult> => {
  try {
    const path = (event as APIGatewayProxyEvent & { rawPath?: string }).rawPath || event.path;
    const pathParts = path.split('/');
    const logId = pathParts[pathParts.length - 1];

    if (!logId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Log ID required' }),
      };
    }

    const logDAO = new ProcessingLogDAO();
    const log = await logDAO.getLog(logId);

    if (!log) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Log not found' }),
      };
    }

    const screenshotBase64 = log.screenshotBase64 ? escapeHtml(log.screenshotBase64) : undefined;
    const screenshot = screenshotBase64
      ? `<img class="screenshot" src="data:image/png;base64,${screenshotBase64}" alt="Processing error screenshot" />`
      : '<p class="empty-state">No error image available.</p>';

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'text/html' },
      body: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Processing Log ${escapeHtml(log.logId)}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 2rem; color: #111827; background: #f9fafb; }
    main { max-width: 960px; margin: 0 auto; background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 1.5rem; }
    h1 { margin-top: 0; }
    dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.75rem 1rem; }
    dt { font-weight: 700; color: #374151; }
    dd { margin: 0; overflow-wrap: anywhere; }
    .message { white-space: pre-wrap; }
    .screenshot { display: block; max-width: 100%; height: auto; border: 1px solid #d1d5db; border-radius: 8px; background: #ffffff; }
    .empty-state { color: #6b7280; font-style: italic; }
  </style>
</head>
<body>
  <main>
    <h1>Processing Log Detail</h1>
    <dl>
      <dt>Log ID</dt><dd>${escapeHtml(log.logId)}</dd>
      <dt>User ID</dt><dd>${escapeHtml(log.userId)}</dd>
      <dt>Processed At</dt><dd>${escapeHtml(log.processedAt)}</dd>
      <dt>Status</dt><dd>${escapeHtml(log.processStatus)}</dd>
      <dt>Message</dt><dd class="message">${escapeHtml(log.message || '')}</dd>
    </dl>
    <h2>Error Image</h2>
    ${screenshot}
  </main>
</body>
</html>`,
    };
  } catch (error) {
    console.error('Get processing log error:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
