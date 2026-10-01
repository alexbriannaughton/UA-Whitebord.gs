// Fixed destination: callers cannot turn the web app into an arbitrary sender.
const WHITEBOARD_DELIVERY_CALLBACK_URL =
  'https://llfukqhlxmftlsjrtkqe.supabase.co/functions/v1/cron-job-every-5-mins-during-open-hours?action=whiteboard-result';

function publishWhiteboardDeliveryResult(request, payload) {
  const params = request?.parameter || {};
  const token = params.ua_callback_token;
  const requestId = params.ua_request_id;
  const attempt = Number(params.ua_attempt);
  if (!/^[a-f0-9]{64}$/.test(token || '') ||
      !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(requestId || '') ||
      !Number.isInteger(attempt) || attempt < 1 || attempt > 3) return;

  try {
    // The token permits only this pending attempt, expires quickly, and is
    // never logged. It gives no access to read results or run the cron.
    const response = UrlFetchApp.fetch(WHITEBOARD_DELIVERY_CALLBACK_URL, {
      method: 'post',
      contentType: 'application/json',
      headers: { 'x-ua-whiteboard-token': token },
      payload: JSON.stringify({ requestId, attempt, payload }),
      muteHttpExceptions: true,
      followRedirects: false,
    });
    logObservedEvent('delivery_callback_completed', {
      uaRequestId: requestId,
      uaAttempt: attempt,
      status: response.getResponseCode(),
    });
  } catch (_error) {
    // UrlFetchApp errors can include request details; omit their contents.
    logObservedEvent('delivery_callback_failed', {
      uaRequestId: requestId,
      uaAttempt: attempt,
    }, true);
  }
}
