const OBSERVABILITY_VERSION = '2026-08-27-phase-0';
const SLOW_PHASE_LOG_THRESHOLD_MS = 2000;

let activeExecutionContext = null;

function beginObservedExecution(entrypoint) {
  activeExecutionContext = {
    entrypoint,
    requestId: Utilities.getUuid(),
    startedAtMs: Date.now(),
    observedExternalCallCount: 0,
  };

  logObservedEvent('request_received');
  return activeExecutionContext;
}

function finishObservedExecution(outcome, details = {}) {
  logObservedEvent('request_completed', {
    ...details,
    outcome,
    observedExternalCallCount:
      activeExecutionContext?.observedExternalCallCount ?? 0,
  });
}

function observePhase(phase, callback, details = {}, alwaysLog = false) {
  const phaseStartedAtMs = Date.now();
  if (alwaysLog) logObservedEvent('phase_started', { ...details, phase });

  try {
    const result = callback();
    const phaseElapsedMs = Date.now() - phaseStartedAtMs;
    if (alwaysLog || phaseElapsedMs >= SLOW_PHASE_LOG_THRESHOLD_MS) {
      logObservedEvent('phase_finished', {
        ...details,
        phase,
        phaseElapsedMs,
        slow: phaseElapsedMs >= SLOW_PHASE_LOG_THRESHOLD_MS,
      });
    }
    return result;
  }
  catch (error) {
    logObservedEvent('phase_failed', {
      ...details,
      phase,
      phaseElapsedMs: Date.now() - phaseStartedAtMs,
      ...observedErrorDetails(error),
    }, true);
    throw error;
  }
}

function observeSpreadsheetCall(
  operation,
  label,
  callback,
  details = {},
  alwaysLog = false
) {
  return observePhase(
    `spreadsheet_${operation}`,
    callback,
    { ...details, label },
    alwaysLog,
  );
}

function observeExternalCall(label, callback, details = {}) {
  if (activeExecutionContext) activeExecutionContext.observedExternalCallCount++;
  return observePhase('external_call', callback, { ...details, label });
}

function logObservedEvent(event, details = {}, isError = false) {
  if (!activeExecutionContext) return;

  const payload = {
    observabilityVersion: OBSERVABILITY_VERSION,
    requestId: activeExecutionContext.requestId,
    entrypoint: activeExecutionContext.entrypoint,
    event,
    elapsedMs: Date.now() - activeExecutionContext.startedAtMs,
    ...details,
  };
  const message = JSON.stringify(payload);

  if (isError) console.error(message);
  else console.log(message);
}

function observedErrorDetails(error) {
  return {
    errorName: error?.name || 'Error',
    errorMessage: error?.message || String(error),
  };
}

function observedApiLabel(url) {
  const match = String(url).match(/\/v\d+\/([^/?]+)/);
  return match ? `ezyvet_${match[1]}` : 'external_api';
}
