const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function rich(text, url = null) {
  return { getText: () => String(text), getLinkUrl: () => url, getRuns() { return [this]; } };
}
class Sheet {
  constructor() { this.rows = Array.from({ length: 500 }, () => Array.from({ length: 10 }, () => ({ value: '', link: rich('') }))); }
  getMaxRows() { return this.rows.length; }
  getLastRow() { return this.rows.findLastIndex(row => row.some(c => c.value !== '' && c.value !== null)) + 1; }
  getRange(row, column, rows = 1, columns = 1) { return new Range(this, row, column, rows, columns); }
  insertRowsAfter(row, count) { this.rows.splice(row, 0, ...Array.from({ length: count }, () => Array.from({ length: 10 }, () => ({ value: '', link: rich('') })))); }
  insertRows(row, count) { this.insertRowsAfter(row - 1, count); }
  deleteRows(row, count) { this.rows.splice(row - 1, count); }
  deleteRow(row) { this.deleteRows(row, 1); }
  setFrozenRows() {}
  setConditionalFormatRules() {}
}
class Range {
  constructor(sheet, row, column, rows, columns) {
    assert.ok(rows > 0 && columns > 0);
    assert.ok(row > 0 && row + rows - 1 <= sheet.rows.length);
    this.sheet = sheet; this.row = row; this.column = column; this.rows = rows; this.columns = columns;
  }
  cells() { return this.sheet.rows.slice(this.row - 1, this.row - 1 + this.rows).map(row => row.slice(this.column - 1, this.column - 1 + this.columns)); }
  getValues() { return this.cells().map(row => row.map(c => c.value)); }
  getRichTextValues() { return this.cells().map(row => row.map(c => c.link)); }
  getValue() { return this.getValues()[0][0]; }
  setValue(value) { return this.setValues([[value]]); }
  setValues(values) {
    assert.equal(values.length, this.rows);
    this.cells().forEach((row, i) => row.forEach((cell, j) => {
      cell.value = values[i][j]; cell.link = rich(typeof cell.value === 'string' ? cell.value : '');
    })); return this;
  }
  setRichTextValue(value) { return this.setRichTextValues([[value]]); }
  setRichTextValues(values) {
    assert.equal(values.length, this.rows);
    this.cells().forEach((row, i) => row.forEach((cell, j) => { cell.link = values[i][j]; cell.value = cell.link.getText(); })); return this;
  }
  clearContent() { this.cells().flat().forEach(c => { c.value = ''; c.link = rich(''); }); return this; }
  offset(row, column, rows = this.rows, columns = this.columns) { return new Range(this.sheet, this.row + row, this.column + column, rows, columns); }
  getCell(row, column) { return this.offset(row - 1, column - 1, 1, 1); }
  getRow() { return this.row; }
  getColumn() { return this.column; }
  getNumRows() { return this.rows; }
  getNumColumns() { return this.columns; }
  getLastRow() { return this.row + this.rows - 1; }
  getSheet() { return this.sheet; }
  copyTo(target) { const values = this.getValues(), links = this.getRichTextValues(); target.setValues(values); target.setRichTextValues(links); }
}
for (const name of ['setWrap', 'setFontColor', 'setBackground', 'setFontLine', 'setBorder', 'setFontWeight', 'setNumberFormat']) {
  Range.prototype[name] = function () { return this; };
}
function appointment(id, animal, contact, type, resource) {
  return { appointment: { id: String(id), active: '1', start_time: String(Date.parse('2026-11-13T16:00:00Z') / 1000), details: {
    animal_id: animal, contact_id: contact, consult_id: 0, appointment_type_id: String(type),
    appointment_status_id: '1', resource_list: [String(resource)], description: 'Synthetic visit',
  } } };
}
function fixture(options = {}) {
  const sheet = new Sheet(); const logs = []; const calls = []; const sleeps = []; const published = [];
  let clock = Date.parse('2026-11-12T20:00:00Z'); let locked = false; let releases = 0;
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  const appts = options.appts || [appointment(101, 1, 11, 79, 35), appointment(102, 2, 22, 115, 26), appointment(103, 3, 33, 19, 60)];
  const formatDate = (date, zone, pattern) => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })
      .formatToParts(date).map(p => [p.type, p.value]));
    if (pattern === 'EEEE MM/dd/yyyy') return `${p.weekday} ${p.month}/${p.day}/${p.year}`;
    throw new Error('Unexpected format: ' + pattern);
  };
  const context = vm.createContext({ Date: Clock, console: { log: x => logs.push(x), error: x => logs.push(x) },
    Utilities: { sleep: ms => { sleeps.push(ms); clock += ms; }, formatDate },
    CacheService: { getScriptCache: () => ({ put() {} }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (locked) return false; locked = true; return true; }, releaseLock: () => { locked = false; releases++; } }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: () => sheet }), flush() {},
      newRichTextValue: () => ({ text: '', url: null, setText(v) { this.text = v; return this; }, setLinkUrl(v) { this.url = v; return this; }, build() { return rich(this.text, this.url); } }),
      newConditionalFormatRule: () => new Proxy({}, { get: (_, key) => key === 'build' ? () => ({}) : () => context.SpreadsheetApp.newConditionalFormatRule() }),
    },
    fetchAndParse(url) {
      assert.equal(locked, false, 'No NDA build API calls may hold the sheet lock');
      const parsed = new URL(url); const endpoint = parsed.pathname.split('/').at(-1); const params = parsed.searchParams;
      calls.push({ url, endpoint, at: clock });
      const filterKey = ['id', 'animal_id', 'contact_id', 'prescription_id', 'record_id', 'consult_id'].find(k => params.has(k));
      const ids = filterKey ? JSON.parse(params.get(filterKey)).in.map(Number) : [];
      let items = [];
      if (endpoint === 'appointment' && params.has('time_range_start')) items = appts;
      else if (endpoint === 'animal') items = ids.map(id => ({ animal: { id: String(filterKey === 'id' ? id : id / 11),
        contact_id: String(filterKey === 'id' ? id * 11 : id), name: `Synthetic ${id}`, species_id: '1', is_hostile: '0' } }));
      else if (endpoint === 'contact') items = ids.map(id => ({ contact: { id: String(id), last_name: 'Fixture' } }));
      else if (endpoint === 'consult') items = ids.map(id => ({ consult: { id: String(id + 1000), animal_id: String(id), date: '1762300800' } }));
      else if (endpoint === 'prescription') items = ids.map(id => ({ prescription: { id: String(id + 2000), animal_id: String(id), date_of_prescription: '1762300800' } }));
      else if (endpoint === 'prescriptionitem') items = ids.map(id => ({ prescriptionitem: { id: String(id + 3000), prescription_id: String(id), product_id: '794' } }));
      else if (endpoint === 'appointment') items = ids.map(id => ({ appointment: { id: String(id + 4000), details: { consult_id: id } } }));
      const normal = { meta: { items_page_total: 1, next_token: null }, items };
      return options.reply ? options.reply({ url, endpoint, params, ids, normal, sheet, context, calls, published }) : normal;
    },
  });
  context.fetchAndParsePage = context.fetchAndParse;
  const files = ['CONSTANTS.js', 'Helpers/Other.js', 'Helpers/Date.js', 'Cron-Jobs/TomorrowsAppts/Fetch.js',
    'Cron-Jobs/TomorrowsAppts/PutDataOnSheet.js', 'Cron-Jobs/TomorrowsAppts/Format.js', 'Cron-Jobs/TomorrowsAppts/Records.js',
    'Cron-Jobs/TomorrowsAppts/Index.js', 'Webhook-Actions/NextDayAppts.js'];
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(__dirname, '../src', file), 'utf8'), context, { filename: file });
  context.ndaUaLocTokenName = loc => 'days_to_next_' + loc.toLowerCase() + '_appts';
  context.epochRangeForFutureDay = days => [Date.parse('2026-11-12T08:00:00Z') / 1000 + days * 86400, Date.parse('2026-11-13T08:00:00Z') / 1000 + days * 86400 - 1];
  const publish = context.publishNdaSection;
  context.publishNdaSection = (...args) => { const r = publish(...args); published.push(args[1]); return r; };
  function rows(location) {
    const s = context.findNdaSection(sheet, location); return s ? sheet.getRange(s.headerRow + 1, 1, s.rows, 10).getValues() : [];
  }
  function seed(location, input, date = 'Thursday 11/12/2026') { context.publishNdaSection(sheet, location, date, input); }
  return { context, sheet, logs, calls, sleeps, published, rows, seed, get releases() { return releases; }, advance: ms => { clock += ms; } };
}

test('all core lists exist before enrichment, and duplicate appointment-day reads are cached', async () => {
  const f = fixture({ reply: r => {
    if (r.endpoint !== 'appointment' || !r.params.has('time_range_start')) assert.deepEqual(r.published, ['DT', 'CH', 'WC']);
    return r.normal;
  } });
  await f.context.runAllNdaJobs();
  assert.equal(f.calls.filter(c => c.url.includes('time_range_start')).length, 1);
  for (const loc of ['DT', 'CH', 'WC']) { assert.equal(f.rows(loc).length, 1); assert.match(f.rows(loc)[0][1], /Synthetic/); }
  assert.ok(f.releases > 0);
});

test('a persistent history transport failure leaves WC listed and its history explicitly unavailable', async () => {
  const f = fixture({ reply: r => {
    if (r.endpoint === 'appointment' && r.params.has('consult_id')) throw Error('Exception: Address unavailable: synthetic');
    return r.normal;
  } });
  await assert.rejects(f.context.runAllNdaJobs(), /needs attention/);
  assert.equal(f.rows('WC').length, 1);
  assert.equal(f.rows('WC')[0][4], 'Unavailable - see chart');
  assert.match(f.rows('WC')[0][7], /gabapentin last filled/);
  assert.equal(f.calls.filter(c => c.endpoint === 'appointment' && c.url.includes('consult_id')).length, 9);
});

test('missing animal data cannot suppress a patient or invent a negative demeanor assessment', async () => {
  const f = fixture({ reply: r => r.endpoint === 'animal' && r.params.has('id') ? { ...r.normal, items: [] } : r.normal });
  await assert.rejects(f.context.runAllNdaJobs(), /needs attention/);
  const row = f.rows('WC')[0]; assert.equal(row[1], 'Unavailable - see chart'); assert.equal(row[6], 'Unavailable - see chart');
  const s = f.context.findNdaSection(f.sheet, 'WC');
  assert.match(f.sheet.getRange(s.headerRow + 1, 2).getRichTextValues()[0][0].getLinkUrl(), /recordid=3$/);
});

test('an optional medication failure never renders no medication', async () => {
  const f = fixture({ reply: r => { if (r.endpoint === 'prescriptionitem') throw Error('synthetic failed lookup'); return r.normal; } });
  await assert.rejects(f.context.runAllNdaJobs(), /needs attention/);
  for (const loc of ['DT', 'CH', 'WC']) assert.equal(f.rows(loc)[0][7], 'Unavailable - see chart');
});

test('budget exhaustion stops new API calls but all three basic lists stay visible', async () => {
  let f;
  f = fixture({ reply: r => { if (r.endpoint === 'consult') f.advance(241000); return r.normal; } });
  await assert.rejects(f.context.runAllNdaJobs(), /needs attention/);
  for (const loc of ['DT', 'CH', 'WC']) assert.equal(f.rows(loc).length, 1);
  assert.ok(f.logs.some(x => String(x).includes('read_budget')));
});

test('a failed core list preserves that location and does not stop other locations', async () => {
  const f = fixture({ appts: [appointment(102, 2, 22, 115, 26), appointment(103, 3, 33, 19, 60)] });
  f.seed('DT', [appointment(99, 9, 99, 79, 35)]);
  await assert.rejects(f.context.runAllNdaJobs(), /DT\/appointments/);
  assert.equal(f.rows('DT').length, 1); assert.match(f.context.findNdaSection(f.sheet, 'DT').text, /11\/12/);
  assert.match(f.context.findNdaSection(f.sheet, 'CH').text, /11\/13/); assert.equal(f.rows('WC').length, 1);
});

test('targeted WC recovery leaves DT and CH rows unchanged', async () => {
  const f = fixture(); f.seed('DT', [appointment(91, 9, 99, 79, 35)]); f.seed('CH', [appointment(92, 8, 88, 115, 26)]);
  const dt = JSON.stringify(f.rows('DT')), ch = JSON.stringify(f.rows('CH'));
  await f.context.rebuildNdaWc();
  assert.equal(JSON.stringify(f.rows('DT')), dt); assert.equal(JSON.stringify(f.rows('CH')), ch); assert.equal(f.rows('WC').length, 1);
});

test('same-date rebuild and in-flight enrichment preserve staff notes and webhook deposit updates', async () => {
  let edited = false;
  const f = fixture({ reply: r => {
    if (!edited && r.endpoint === 'prescription') {
      const s = r.context.findNdaSection(r.sheet, 'WC');
      r.sheet.getRange(s.headerRow + 1, 3).setValue('yes'); r.sheet.getRange(s.headerRow + 1, 5).setValue('Staff note'); edited = true;
    }
    return r.normal;
  } });
  await f.context.runAllNdaJobs();
  assert.equal(f.rows('WC')[0][2], 'yes'); assert.equal(f.rows('WC')[0][4], 'Staff note');
  await f.context.rebuildNdaWc();
  assert.equal(f.rows('WC')[0][2], 'yes'); assert.equal(f.rows('WC')[0][4], 'Staff note');
});

test('section resizing preserves the following location and rejects duplicate headers', () => {
  const f = fixture(); f.seed('DT', [appointment(1, 1, 11, 79, 35)]); f.seed('WC', [appointment(3, 3, 33, 19, 60)]);
  const wc = JSON.stringify(f.rows('WC'));
  f.seed('DT', [appointment(1, 1, 11, 79, 35), appointment(2, 2, 22, 79, 35)]);
  assert.equal(JSON.stringify(f.rows('WC')), wc);
  f.seed('DT', [appointment(1, 1, 11, 79, 35)]); assert.equal(JSON.stringify(f.rows('WC')), wc);
  f.sheet.getRange(f.sheet.getLastRow() + 1, 1).setValue('WC-\nFriday 11/13/2026');
  assert.throws(() => f.context.findNdaSection(f.sheet, 'WC'), /Duplicate/);
});

test('webhook guard refuses to write tomorrow into a retained stale section', () => {
  const f = fixture(); f.seed('WC', [appointment(3, 3, 33, 19, 60)]);
  assert.throws(() => f.context.getNdaRangeForLoc(f.sheet, 'WC', 'Friday 11/13/2026'), /needs rebuilding/);
});

test('bulk medication lookup deduplicates patients and skips empty prescription-item filters', () => {
  const appts = Array.from({ length: 40 }, (_, i) => appointment(i + 1, i + 1, (i + 1) * 11, 19, 60));
  const f = fixture({ reply: r => r.endpoint === 'prescription' ? { ...r.normal, items: [] } : r.normal });
  f.context.startNdaReadSession(); f.context.fetchNdaMedicalData([...appts, appts[0]]);
  assert.equal(f.calls.filter(c => c.endpoint === 'consult').length, 1);
  assert.equal(f.calls.filter(c => c.endpoint === 'prescription').length, 1);
  assert.equal(f.calls.filter(c => c.endpoint === 'prescriptionitem').length, 0);
  assert.ok(appts.every(a => a.ndaMedicationReady));
});

test('only a failed GET is retried; successful ID chunks are reused and paced', () => {
  let tries = 0;
  const f = fixture({ reply: r => { if (r.endpoint === 'animal' && r.ids.includes(51) && tries++ === 0) throw Error('Address unavailable'); return r.normal; } });
  f.context.startNdaReadSession(); f.context.ndaFetchByIds('animal', 'id', Array.from({ length: 51 }, (_, i) => i + 1));
  assert.equal(f.calls.length, 3); assert.equal(f.calls.filter(c => !c.url.includes('%2251%22')).length, 1);
  assert.ok(f.calls[1].at - f.calls[0].at >= 1500); assert.ok(f.calls[2].at - f.calls[1].at >= 1500);
});

test('all pages are read and out-of-scope or malformed responses are rejected', () => {
  const f = fixture({ reply: r => ({ meta: { items_page_total: 2, items_page: r.params.get('page') },
    items: [r.normal.items[Number(r.params.get('page')) - 1]] }) });
  f.context.startNdaReadSession(); assert.equal(f.context.ndaFetchByIds('contact', 'id', [11, 22]).length, 2);
  const bad = fixture({ reply: () => ({ meta: { items_page_total: 1, next_token: null }, items: [{ animal: { id: '999' } }] }) });
  bad.context.startNdaReadSession(); assert.throws(() => bad.context.ndaFetchByIds('animal', 'id', [1]), /outside requested scope/);
  const missing = fixture({ reply: () => ({ items: [] }) }); missing.context.startNdaReadSession();
  assert.throws(() => missing.context.ndaReadAll('https://api.ezyvet.com/v1/animal?active=1'), /Invalid NDA pagination/);
  const repeated = fixture({ reply: r => ({ meta: { items_page_total: 2 }, items: r.normal.items }) });
  repeated.context.startNdaReadSession(); assert.throws(() => repeated.context.ndaFetchByIds('contact', 'id', [11]), /duplicate/);
});

test('a new webhook row added during enrichment is preserved and existing patients get their own data', async () => {
  let added = false;
  const f = fixture({ reply: r => {
    if (!added && r.endpoint === 'prescription') {
      r.context.getAnimalInfoAndLastName = () => ['New synthetic patient', 'K9', 'Otherfamily', false];
      r.context.handleNextDayAppt({ animal_id: 4, contact_id: 44, consult_id: 404, type_id: 19, status_id: 1,
        active: true, start_at: Date.parse('2026-11-13T17:00:00Z') / 1000, description: 'New synthetic visit' }, 'WC');
      added = true;
    }
    return r.normal;
  } });
  await f.context.runAllNdaJobs();
  const rows = f.rows('WC'); assert.equal(rows.length, 2);
  assert.match(rows[0][1], /Synthetic 3/); assert.match(rows[0][7], /gabapentin/);
  assert.match(rows[1][1], /New synthetic patient/); assert.equal(rows[1][3], 'New synthetic visit');
});

test('cancelling the last NDA patient leaves an empty section that accepts another patient', () => {
  const f = fixture(); f.seed('WC', [appointment(103, 3, 33, 19, 60)], 'Friday 11/13/2026');
  const date = Date.parse('2026-11-13T16:00:00Z') / 1000;
  f.context.handleNextDayAppt({ animal_id: 3, active: false, start_at: date }, 'WC');
  f.context.getAnimalInfoAndLastName = () => ['New synthetic patient', 'K9', 'Otherfamily', false];
  f.context.handleNextDayAppt({ animal_id: 4, contact_id: 44, consult_id: 404, type_id: 19, status_id: 1,
    active: true, start_at: date, description: 'Replacement synthetic visit' }, 'WC');
  assert.equal(f.rows('WC').length, 1); assert.match(f.rows('WC')[0][1], /New synthetic patient/);
});

test('a legacy empty section can be filled without overwriting the next location header', () => {
  const f = fixture(); f.sheet.getRange(1, 1).setValue('Time:');
  f.sheet.getRange(2, 1).setValue('DT-\nFriday 11/13/2026');
  f.seed('WC', [appointment(103, 3, 33, 19, 60)], 'Friday 11/13/2026');
  const wc = JSON.stringify(f.rows('WC'));
  const empty = f.context.getNdaRangeForLoc(f.sheet, 'DT', 'Friday 11/13/2026');
  assert.equal(empty.getRow(), 3); assert.equal(empty.getNumRows(), 1);
  assert.equal(JSON.stringify(f.rows('WC')), wc);
});

test('failed other-pet history never marks an unverified client as first-time', async () => {
  const f = fixture({ reply: r => {
    if (r.endpoint === 'consult') return { ...r.normal, items: [] };
    if (r.endpoint === 'animal' && r.params.has('contact_id')) throw Error('Address unavailable');
    return r.normal;
  } });
  await assert.rejects(f.context.runAllNdaJobs(), /needs attention/);
  assert.equal(f.rows('WC')[0][4], 'Unavailable - see chart');
});


test('DEV animal cursor pages retain filters, are paced, and reject invalid continuations', () => {
  const f = fixture({ reply: r => {
    assert.equal(r.params.get('id'), '{"in":["1","2"]}');
    assert.equal(r.params.get('active'), '1'); assert.equal(r.params.get('page_size'), '200');
    const continued = r.params.has('next_token');
    return { meta: { next_token: continued ? null : 'fixture-cursor' }, items: [r.normal.items[continued ? 1 : 0]] };
  } });
  f.context.startNdaReadSession(); assert.equal(f.context.ndaFetchByIds('animal', 'id', [1, 2]).length, 2);
  assert.equal(f.calls.length, 2); assert.ok(f.calls[1].at - f.calls[0].at >= 1500);
  assert.equal(new URL(f.calls[1].url).searchParams.get('next_token'), 'fixture-cursor');
  const malformed = fixture({ reply: r => ({ ...r.normal, meta: { next_token: {} } }) });
  malformed.context.startNdaReadSession(); assert.throws(() => malformed.context.ndaFetchByIds('animal', 'id', [1]), /Invalid NDA animal cursor/);
  const repeated = fixture({ reply: r => ({ meta: { next_token: 'same-cursor' }, items: [{ animal: { id: String(r.calls.length) } }] }) });
  repeated.context.startNdaReadSession(); assert.throws(() => repeated.context.ndaFetchByIds('animal', 'id', [1, 2]), /Repeated NDA animal cursor/);
});
