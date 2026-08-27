const OBSERVABILITY_VERSION = '2026-08-27-phase-0.1';
const SLOW_PHASE_LOG_THRESHOLD_MS = 2000;

let activeExecutionContext = null;

function beginObservedExecution(entrypoint) {
  activeExecutionContext = {
    entrypoint,
    requestId: Utilities.getUuid(),
    startedAtMs: Date.now(),
    observedExternalCallCount: 0,
    phaseMetrics: {},
    summary: {},
    requestReceivedLogged: false,
  };

  return activeExecutionContext;
}

function logObservedRequestReceived(details = {}) {
  if (!activeExecutionContext || activeExecutionContext.requestReceivedLogged) {
    return;
  }

  activeExecutionContext.requestReceivedLogged = true;
  logObservedEvent('request_received', details);
}

function setObservedSummary(key, value) {
  if (!activeExecutionContext) return;
  activeExecutionContext.summary[key] = value;
}

function finishObservedExecution(outcome, details = {}) {
  logObservedEvent('request_completed', {
    ...details,
    outcome,
    observedExternalCallCount:
      activeExecutionContext?.observedExternalCallCount ?? 0,
    phaseMetrics: activeExecutionContext?.phaseMetrics ?? {},
    summary: activeExecutionContext?.summary ?? {},
  });
  activeExecutionContext = null;
}

function observePhase(phase, callback, details = {}) {
  const phaseStartedAtMs = Date.now();

  try {
    const result = callback();
    const phaseElapsedMs = Date.now() - phaseStartedAtMs;
    recordObservedPhase(phase, phaseElapsedMs);
    if (phaseElapsedMs >= SLOW_PHASE_LOG_THRESHOLD_MS) {
      logObservedEvent('phase_finished', {
        ...details,
        phase,
        phaseElapsedMs,
        slow: true,
      });
    }
    return result;
  }
  catch (error) {
    const phaseElapsedMs = Date.now() - phaseStartedAtMs;
    recordObservedPhase(phase, phaseElapsedMs);
    logObservedEvent('phase_failed', {
      ...details,
      phase,
      phaseElapsedMs,
      ...observedErrorDetails(error),
    }, true);
    throw error;
  }
}

function observeSpreadsheetCall(
  operation,
  label,
  callback,
  details = {}
) {
  return observePhase(
    `spreadsheet_${operation}`,
    callback,
    { ...details, label },
  );
}

function observeExternalCall(label, callback, details = {}) {
  if (activeExecutionContext) activeExecutionContext.observedExternalCallCount++;
  return observePhase('external_call', callback, { ...details, label });
}

function recordObservedPhase(phase, elapsedMs) {
  if (!activeExecutionContext) return;

  const metric = activeExecutionContext.phaseMetrics[phase] || {
    count: 0,
    totalMs: 0,
    maxMs: 0,
  };
  metric.count++;
  metric.totalMs += elapsedMs;
  metric.maxMs = Math.max(metric.maxMs, elapsedMs);
  activeExecutionContext.phaseMetrics[phase] = metric;
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
