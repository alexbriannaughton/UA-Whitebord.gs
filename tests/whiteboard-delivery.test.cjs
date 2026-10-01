const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const helper = fs.readFileSync('src/Helpers/WhiteboardDelivery.js', 'utf8');
const code = fs.readFileSync('src/Code.js', 'utf8');
const requestId = '11111111-1111-1111-1111-111111111111';
const token = 'ab'.repeat(32);
const request = { parameter: { ua_request_id: requestId, ua_attempt: '1', ua_callback_token: token } };
function harness(fails = false) {
  let reads = 0;
  const calls = [], logs = [];
  const payload = { roomsWithLinks: {}, wait: [], locationPossPositionNames: {} };
  const context = vm.createContext({
    UrlFetchApp: { fetch(url, options) { calls.push({ url, options }); if (fails) throw new Error(token); return { getResponseCode: () => 200 }; } },
    logObservedEvent: (...args) => logs.push(args),
    beginObservedExecution() {}, logObservedRequestReceived() {}, finishObservedExecution() {},
    observeSpreadsheetCall: (_a, _b, fn) => fn(),
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheets: () => [] }) },
    extractMainSheetData() { reads++; return { ...payload, numOfRoomsInUse: {} }; },
    getWaitData: () => [],
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (body) => ({ setMimeType: () => JSON.parse(body) }) },
    Utilities: { sleep() { throw new Error('Unexpected extraction retry'); } },
  });
  vm.runInContext(helper + '\n' + code, context);
  return { context, calls, logs, get reads() { return reads; } };
}
test('publishes the exact result once before returning it', () => {
  const h = harness(); const result = h.context.doGet(request);
  assert.equal(h.reads, 1); assert.equal(h.calls.length, 1);
  assert.deepEqual(JSON.parse(h.calls[0].options.payload).payload, result);
  assert.equal(h.calls[0].options.headers['x-ua-whiteboard-token'], token);
  assert.equal(h.calls[0].options.followRedirects, false);
  assert.ok(!JSON.stringify(h.logs).includes(token));
});
test('callback failure preserves successful extraction and ordinary response', () => {
  const h = harness(true); assert.ok(h.context.doGet(request));
  assert.equal(h.reads, 1); assert.equal(h.calls.length, 1);
  assert.ok(!JSON.stringify(h.logs).includes(token));
});
test('ordinary requests and invalid capabilities produce no callback', () => {
  const h = harness(); h.context.doGet();
  h.context.doGet({ parameter: { ...request.parameter, ua_callback_token: 'bad' } });
  assert.equal(h.calls.length, 0);
});
