/**
 * BADYET  <->  GOOGLE SHEETS BRIDGE  ·  layout v10 + accounts (linked by ID, plain-word headers, PIN lock, Plan + Debt tab & 4 Tanks)
 * ------------------------------------------------------------------
 * 1. In your Google Sheet: Extensions > Apps Script.
 * 2. Paste this file into Code.gs (and Index.html into an HTML file named Index). Save.
 * 3. Deploy > New deployment > gear icon > "Web app"
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Click Deploy and authorize. Open the Web app URL: that link IS the Badyet app.
 * 4. Reload the sheet and use the "Badyet" menu > "Tidy up layout & look".
 *
 * After pasting a NEW version of this script: Deploy > Manage deployments >
 * edit (pencil) > Version: "New version" > Deploy. The URL stays the same.
 *
 * Tabs (created automatically, older Badyet layouts are migrated for you):
 *   Guide · Plan · Transactions · Accounts · Expense Categories · Income Categories
 *   Budgets · Bills · Goals · Lists · Settings
 */

/* Optional: browser-tab icon for the published app. Paste a public link to
   icon-192.png here. Leave empty to skip. */
var FAVICON_URL = '';

var LAYOUT_VERSION = '10';

/* Which spreadsheet this request works on. Empty = the sheet this script lives in (yours). */
var CUR_SS_ = null, CUR_ACCT_ = null;
function SS_() { return CUR_SS_ || SpreadsheetApp.getActive(); }
function layoutKey_(ss) {
  var a = SpreadsheetApp.getActive();
  return (!CUR_SS_ || (a && ss.getId() === a.getId())) ? 'BADYET_LAYOUT' : 'BADYET_LAYOUT_' + ss.getId();
}

/* Dropdown options (the Lists tab). Values here are what the sheet shows. */
var LISTS = [
  ['Transaction types', ['Income', 'Expense', 'Transfer', 'Card payment', 'Refund']],
  ['Account types', ['Cash', 'Bank', 'E-wallet', 'Savings', 'Credit card', 'Loan']],
  ['Bill types', ['Expense', 'Income']],
  ['Frequencies', ['Weekly', 'Every 2 weeks', 'Monthly', 'Quarterly', 'Yearly']],
  ['Statuses', ['Active', 'Paused']],
  ['Budget periods', ['Monthly', 'Weekly']],
  ['Payment methods', ['Cash', 'Debit Card', 'Credit Card', 'Bank Transfer', 'E-Wallet', 'Autopay', 'ATM', 'Other']],
  ['Plan groups', ['Needs', 'Wants', 'Debts', 'Savings']]
];
/* Older or shorthand values that should be cleaned into the labels above. */
var LIST_SYNONYMS = {
  'Transaction types': { ccpayment: 'Card payment', creditcardpayment: 'Card payment', payment: 'Card payment', expenses: 'Expense' },
  'Account types': { wallet: 'E-wallet', gcash: 'E-wallet', credit: 'Credit card', card: 'Credit card', saving: 'Savings' },
  'Frequencies': { biweekly: 'Every 2 weeks', fortnightly: 'Every 2 weeks', every2weeks: 'Every 2 weeks', annually: 'Yearly', annual: 'Yearly' },
  'Plan groups': { debt: 'Debts', need: 'Needs', want: 'Wants', saving: 'Savings' }
};
var ALL_SPENDING = 'All spending';   // budget row that limits total spending
var ALL_SPENDING_ID = 'ALL';

/* Columns: [key, header, kind]
   kinds: id | text | note | date | month | money | number | bool | sys
          list:<Lists column> | link:<acc|cat|budcat> (name you pick) | linkid:<...> (filled in) */
var SCHEMA = {
  Transactions: { title: 'Transactions', prefix: 'TXN', key: 'id', sort: { key: 'date', asc: false }, cols: [
    ['id', 'ID', 'id'],
    ['date', 'Date', 'date'],
    ['type', 'Type', 'list:Transaction types'],
    ['description', 'Description', 'text'],
    ['amount', 'Amount', 'money'],
    ['category', 'Category', 'link:cat'],
    ['categoryId', 'Category ID', 'linkid:cat'],
    ['fromAccount', 'From account', 'link:acc'],
    ['fromAccountId', 'From account ID', 'linkid:acc'],
    ['toAccount', 'To account', 'link:acc'],
    ['toAccountId', 'To account ID', 'linkid:acc'],
    ['method', 'Payment method', 'list:Payment methods'],
    ['notes', 'Notes', 'note'],
    ['tags', 'Tags', 'text'],
    ['recurringId', 'Bill ID', 'sys'],
    ['refundOf', 'Refund of', 'sys']] },
  Accounts: { title: 'Accounts', prefix: 'ACC', key: 'id', cols: [
    ['id', 'ID', 'id'],
    ['name', 'Name', 'text'],
    ['type', 'Type', 'list:Account types'],
    ['openingBalance', 'Starting balance', 'money'],
    ['openingDate', 'Start date', 'date'],
    ['apr', 'Interest rate (APR %)', 'number'],
    ['minPayment', 'Minimum payment', 'money'],
    ['dueDay', 'Due day', 'number'],
    ['plannedPayment', 'Planned payment', 'money'],
    ['archived', 'Archived', 'bool'],
    ['notes', 'Notes', 'note']] },
  ExpenseCategories: { title: 'Expense Categories', prefix: 'EXP', key: 'id', cols: [
    ['id', 'ID', 'id'],
    ['name', 'Name', 'text'],
    ['essential', 'Essential', 'bool']] },
  IncomeCategories: { title: 'Income Categories', prefix: 'INC', key: 'id', cols: [
    ['id', 'ID', 'id'],
    ['name', 'Name', 'text']] },
  Budgets: { title: 'Budgets', prefix: 'BUD', key: 'id', sort: { key: 'month', asc: false }, cols: [
    ['id', 'ID', 'id'],
    ['month', 'Month', 'month'],
    ['category', 'Category', 'link:budcat'],
    ['categoryId', 'Category ID', 'linkid:budcat'],
    ['scope', 'Period', 'list:Budget periods'],
    ['amount', 'Amount', 'money'],
    ['rollover', 'Rollover', 'bool']] },
  Bills: { title: 'Bills', prefix: 'BIL', key: 'id', sort: { key: 'nextDue', asc: true }, cols: [
    ['id', 'ID', 'id'],
    ['description', 'Description', 'text'],
    ['type', 'Type', 'list:Bill types'],
    ['amount', 'Amount', 'money'],
    ['category', 'Category', 'link:cat'],
    ['categoryId', 'Category ID', 'linkid:cat'],
    ['account', 'Account', 'link:acc'],
    ['accountId', 'Account ID', 'linkid:acc'],
    ['frequency', 'Frequency', 'list:Frequencies'],
    ['startDate', 'First date', 'date'],
    ['endDate', 'End date', 'date'],
    ['nextDue', 'Next due', 'date'],
    ['status', 'Status', 'list:Statuses']] },
  Goals: { title: 'Goals', prefix: 'GOL', key: 'id', cols: [
    ['id', 'ID', 'id'],
    ['name', 'Name', 'text'],
    ['target', 'Target', 'money'],
    ['saved', 'Saved so far', 'money'],
    ['targetDate', 'Target date', 'date'],
    ['monthlyContribution', 'Monthly amount', 'money']] },
  Plan: { title: 'Plan', prefix: 'PLN', key: 'id', cols: [
    ['id', 'ID', 'id'],
    ['group', 'Group', 'list:Plan groups'],
    ['name', 'Category or goal', 'text'],
    ['pct', 'Percent of income', 'number'],
    ['amount', 'Fixed amount', 'money'],
    ['worksOut', 'Works out to', 'sys'],
    ['rollover', 'Rollover', 'bool'],
    ['target', 'Goal target', 'money'],
    ['targetDate', 'Goal date', 'date'],
    ['paid', 'Paid so far', 'money'],
    ['months', 'Payoff months', 'number'],
    ['freq', 'Payment frequency', 'list:Frequencies'],
    ['icon', 'Icon', 'text']] },
  Settings: { title: 'Settings', key: 'key', cols: [
    ['key', 'Setting', 'text'],
    ['value', 'Value', 'text'],
    ['note', 'What it does', 'note']] }
};
/* name column <-> ID column pairs; the name is what you pick, the ID is the real link */
var LINKS = {
  Transactions: [['category', 'categoryId', 'cat'], ['fromAccount', 'fromAccountId', 'acc'], ['toAccount', 'toAccountId', 'acc']],
  Budgets: [['category', 'categoryId', 'budcat']],
  Bills: [['category', 'categoryId', 'cat'], ['account', 'accountId', 'acc']]
};
/* pre-v7 code-style headers, so older sheets migrate cleanly */
var OLD_HEADERS = {
  Accounts: { openingbalance: 'openingBalance', openingdate: 'openingDate' },
  Bills: { startdate: 'startDate', enddate: 'endDate', nextdue: 'nextDue' },
  Goals: { saved: 'saved', targetdate: 'targetDate', monthlycontribution: 'monthlyContribution' },
  Transactions: { recurringid: 'recurringId', refundof: 'refundOf' }
};
var TAB_ORDER = ['Guide', 'Plan', 'Transactions', 'Accounts', 'Expense Categories', 'Income Categories', 'Budgets', 'Bills', 'Goals', 'Lists', 'Settings'];

/* ================= Web app entry points ================= */
function doGet(e) {
  var p = (e && e.parameter) || {};
  if (!p.action && !p.callback) {   // no parameters: serve the app itself
    var page = HtmlService.createHtmlOutputFromFile('Index')
      .setTitle('badyet')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
      .addMetaTag('mobile-web-app-capable', 'yes')
      .addMetaTag('apple-mobile-web-app-capable', 'yes')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    if (FAVICON_URL) { try { page.setFaviconUrl(FAVICON_URL); } catch (x) {} }
    return page;
  }
  var cb = (p.callback && /^[A-Za-z_$][\w$.]{0,80}$/.test(p.callback)) ? p.callback : null;
  var res;
  try {
    var data = p.action === 'unlock' ? apiUnlock(p.pin)
             : p.action === 'setpin' ? apiSetPin(p.token, p.pin)
             : p.action === 'lock' ? apiLock(p.token) : apiGet(p.token);
    res = { ok: true, app: 'badyet', version: 8, data: data };
  }
  catch (err) { res = { ok: false, error: String((err && err.message) || err) }; }
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + JSON.stringify(res) + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return out_(res);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'auth') return out_({ ok: true, data: apiAuth(body.op, body.payload || {}, body.token) });
    var data = body.action === 'replace' ? apiReplace(body.data, body.token)
             : body.action === 'apply' ? apiApply(body.ops, body.token)
             : body.action === 'unlock' ? apiUnlock(body.pin)
             : body.action === 'setpin' ? apiSetPin(body.token, body.pin)
             : body.action === 'lock' ? apiLock(body.token) : apiGet(body.token);
    return out_({ ok: true, data: data });
  } catch (err) {
    return out_({ ok: false, error: String((err && err.message) || err) });
  }
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/* ---- Called directly by the hosted page (google.script.run) ---- */
function apiGet(token) {
  var g = gate_(token); if (g) return g;
  return withLock_(readAll_, 8000);
}
function apiApply(ops, token) {
  var g = gate_(token); if (g) return g;
  return withLock_(function () {
    ensureSheets_();
    var byTable = {};
    (ops || []).forEach(function (op) {
      if (!SCHEMA[op.table]) return;
      var b = byTable[op.table] = byTable[op.table] || { ups: [], dels: [] };
      if (op.op === 'upsert') b.ups = b.ups.concat(op.rows || []);
      if (op.op === 'delete') b.dels = b.dels.concat(op.keys || []);
    });
    Object.keys(byTable).forEach(function (t) { applyTable_(t, byTable[t].ups, byTable[t].dels, false); });
    SpreadsheetApp.flush();
    return readAll_();
  }, 25000);
}
function apiReplace(data, token) {
  var g = gate_(token); if (g) return g;
  return withLock_(function () {
    ensureSheets_();
    Object.keys(SCHEMA).forEach(function (name) { applyTable_(name, (data && data[name]) || [], [], true); });
    SpreadsheetApp.flush();
    return readAll_();
  }, 25000);
}

/* ================= PIN lock =================
   The PIN is never stored: only a salted SHA-256 hash, in Script Properties
   (not in the sheet). A correct PIN gives the device a random key that lasts
   30 days. After 5 wrong tries, unlocking pauses for 5 minutes. */
var PIN_KEY = 'BADYET_PIN', TOK_KEY = 'BADYET_TOKENS', FAIL_KEY = 'BADYET_PIN_FAILS';
var TOKEN_DAYS = 30, MAX_TRIES = 5, WAIT_MIN = 5;
function props_() { return PropertiesService.getScriptProperties(); }
function hash_(salt, pin) {
  var b = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + ':' + pin, Utilities.Charset.UTF_8);
  return b.map(function (x) { return ('0' + (x & 255).toString(16)).slice(-2); }).join('');
}
function pinOn_() { return !!props_().getProperty(PIN_KEY); }
function tokens_() { try { return JSON.parse(props_().getProperty(TOK_KEY) || '{}'); } catch (e) { return {}; } }
function saveTokens_(t) {
  var now = Date.now();
  Object.keys(t).forEach(function (k) { if (!(t[k] > now)) delete t[k]; });
  props_().setProperty(TOK_KEY, JSON.stringify(t));
}
function unlocked_(token) {
  if (!pinOn_()) return true;
  var t = tokens_();
  return !!(token && t[token] && t[token] > Date.now());
}
function locked_() { return { __locked: true, __pin: true }; }
function newToken_() {
  var t = tokens_(), k = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  t[k] = Date.now() + TOKEN_DAYS * 86400000;
  saveTokens_(t);
  return k;
}
function apiUnlock(pin) {
  if (accountsOn_()) return { ok: false, error: 'Accounts are on. Log in with your username and password.' };
  return withLock_(function () {
    if (!pinOn_()) return { ok: true, token: '' };
    var p = props_(), now = Date.now();
    var f = String(p.getProperty(FAIL_KEY) || '0:0').split(':'), n = +f[0] || 0, until = +f[1] || 0;
    if (until > now) return { ok: false, wait: Math.ceil((until - now) / 1000) };
    var st = String(p.getProperty(PIN_KEY)).split(':');
    pin = str_(pin);
    if (st.length === 2 && /^\d{4,8}$/.test(pin) && hash_(st[0], pin) === st[1]) {
      p.setProperty(FAIL_KEY, '0:0');
      return { ok: true, token: newToken_() };
    }
    n++;
    if (n >= MAX_TRIES) { p.setProperty(FAIL_KEY, '0:' + (now + WAIT_MIN * 60000)); return { ok: false, wait: WAIT_MIN * 60 }; }
    p.setProperty(FAIL_KEY, n + ':0');
    return { ok: false, left: MAX_TRIES - n };
  }, 8000);
}
/* Set, change (pin = 4-8 digits) or remove (pin = '') the PIN. Needs an unlocked device. */
function apiSetPin(token, pin) {
  if (accountsOn_()) return { ok: false, error: 'Accounts are on, so the PIN is no longer used.' };
  return withLock_(function () {
    if (!unlocked_(token)) return locked_();
    var p = props_();
    pin = str_(pin);
    if (!pin) {
      [PIN_KEY, TOK_KEY, FAIL_KEY].forEach(function (k) { p.deleteProperty(k); });
      return { ok: true, pin: false };
    }
    if (!/^\d{4,8}$/.test(pin)) return { ok: false, error: 'Use 4 to 8 digits, numbers only.' };
    var salt = Utilities.getUuid();
    p.setProperty(PIN_KEY, salt + ':' + hash_(salt, pin));
    p.deleteProperty(TOK_KEY);          // every other device has to unlock again
    p.setProperty(FAIL_KEY, '0:0');
    return { ok: true, pin: true, token: newToken_() };
  }, 8000);
}
function apiLock(token) {
  var t = tokens_();
  if (token && t[token]) { delete t[token]; saveTokens_(t); }
  return { ok: true };
}
/* Badyet menu > Remove app PIN (only people who can edit the sheet can run it). */
function removeAppPin() {
  var p = props_();
  [PIN_KEY, TOK_KEY, FAIL_KEY].forEach(function (k) { p.deleteProperty(k); });
  try { SpreadsheetApp.getActive().toast('The app PIN is removed. Set a new one in the app under Settings.', 'Badyet', 8); } catch (e) {}
}

function withLock_(fn, ms) {
  var lock = LockService.getScriptLock();
  var got = false;
  try { got = lock.tryLock(ms); } catch (x) {}
  try { return fn(); }
  finally { if (got) { try { lock.releaseLock(); } catch (x) {} } }
}

/* ================= Helpers ================= */
function norm_(s) { return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, ''); }
function str_(v) { return String(v == null ? '' : v).trim(); }
function isEmptyRow_(r) { return r.every(function (v) { return v === '' || v === null || v === undefined; }); }
function newId_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 6).toUpperCase(); }
function listIndex_(name) { for (var i = 0; i < LISTS.length; i++) if (LISTS[i][0] === name) return i; return -1; }
function colLetter_(i) { var s = ''; i++; while (i > 0) { var m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; }
function kindOf_(name, key) { var c = SCHEMA[name].cols.filter(function (x) { return x[0] === key; })[0]; return c ? c[2] : 'text'; }
function toBool_(v) { return v === true || /^(true|yes|y|1|x)$/i.test(str_(v)); }

function label_(listName, v) {
  var s = str_(v);
  if (!s) return '';
  var i = listIndex_(listName);
  if (i < 0) return s;
  var n = norm_(s), opts = LISTS[i][1];
  for (var j = 0; j < opts.length; j++) if (norm_(opts[j]) === n) return opts[j];
  var syn = LIST_SYNONYMS[listName];
  return (syn && syn[n]) || s;
}

/* Clean one value for its column before writing it. */
function cleanValue_(kind, v) {
  if (v === null || v === undefined) return '';
  if (kind.indexOf('list:') === 0) return label_(kind.slice(5), v);
  if (kind === 'bool') return toBool_(v);
  if ((kind === 'money' || kind === 'number') && typeof v === 'string' && v.trim() !== '') {
    var n = parseFloat(v.replace(/[₱,\s]/g, ''));
    return isFinite(n) ? n : v;
  }
  return v;
}

/* Header row -> {key: column index}. */
function headMap_(name, head, loose) {
  var cols = SCHEMA[name].cols, map = {}, old = loose ? (OLD_HEADERS[name] || {}) : {};
  head.forEach(function (h, i) {
    var n = norm_(h);
    if (!n) return;
    for (var j = 0; j < cols.length; j++) {
      var k = cols[j][0];
      if (map[k] === undefined && (norm_(k) === n || norm_(cols[j][1]) === n)) { map[k] = i; return; }
    }
    if (old[n] && map[old[n]] === undefined) map[old[n]] = i;
  });
  return map;
}

function cell_(v, kind, tz) {
  if (v instanceof Date) return Utilities.formatDate(v, tz, kind === 'month' ? 'yyyy-MM' : 'yyyy-MM-dd');
  return v;
}

/* ================= Layout setup & migration ================= */
function ensureSheets_(force) {
  var ss = SS_(), props = PropertiesService.getScriptProperties();
  var have = ss.getSheets().map(function (s) { return s.getName(); });
  var complete = TAB_ORDER.every(function (t) { return have.indexOf(t) >= 0; });
  if (!force && complete && props.getProperty(layoutKey_(ss)) === LAYOUT_VERSION) return;
  setupLayout_();
  props.setProperty(layoutKey_(ss), LAYOUT_VERSION);
}

function setupLayout_() {
  var ss = SS_(), tz = ss.getSpreadsheetTimeZone();
  var oldCats = ss.getSheetByName('Categories');
  var oldCatRows = oldCats ? readOldCategories_(oldCats) : null;

  Object.keys(SCHEMA).forEach(function (name) {
    var t = SCHEMA[name], sh = ss.getSheetByName(t.title);
    var headers = t.cols.map(function (c) { return c[1]; });
    if (!sh) { sh = ss.insertSheet(t.title); rebuildTab_(sh, name, []); return; }
    var lc = Math.max(sh.getLastColumn(), 1);
    var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return str_(h); });
    var same = head.length >= headers.length && headers.every(function (h, i) { return head[i] === h; });
    if (same) return;
    rebuildTab_(sh, name, readObjects_(sh, name, tz));   // migrate an older layout
  });

  if (oldCatRows) {   // old single "Categories" tab -> two tabs
    var exp = [], inc = [];
    oldCatRows.forEach(function (c) {
      if (c.kind === 'income') inc.push({ name: c.name });
      else exp.push({ name: c.name, essential: c.essential });
    });
    if (ss.getSheetByName('Expense Categories').getLastRow() <= 1) applyTable_('ExpenseCategories', exp, [], true);
    if (ss.getSheetByName('Income Categories').getLastRow() <= 1) applyTable_('IncomeCategories', inc, [], true);
    ss.deleteSheet(oldCats);
  }

  writeLists_();
  writeGuide_();
  Object.keys(SCHEMA).forEach(function (name) { styleSheet_(ss.getSheetByName(SCHEMA[name].title), name); });
  var s1 = ss.getSheetByName('Sheet1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  orderTabs_();
}

function readOldCategories_(sh) {
  var vals = sh.getDataRange().getValues(), head = (vals[0] || []).map(norm_), out = [];
  var iN = head.indexOf('name'), iK = head.indexOf('kind'), iE = head.indexOf('essential');
  if (iN < 0) return out;
  for (var r = 1; r < vals.length; r++) {
    var n = str_(vals[r][iN]);
    if (!n) continue;
    out.push({ name: n, kind: iK >= 0 && norm_(vals[r][iK]) === 'income' ? 'income' : 'expense', essential: iE >= 0 && toBool_(vals[r][iE]) });
  }
  return out;
}

function readObjects_(sh, name, tz) {
  var vals = sh.getDataRange().getValues();
  var head = (vals[0] || []).map(function (h) { return str_(h); });
  var map = headMap_(name, head, true), out = [];
  for (var r = 1; r < vals.length; r++) {
    if (isEmptyRow_(vals[r])) continue;
    var o = {};
    SCHEMA[name].cols.forEach(function (c) {
      var j = map[c[0]];
      if (j !== undefined) o[c[0]] = cell_(vals[r][j], c[2], tz);
    });
    out.push(o);
  }
  return out;
}

/* Wipe a tab and write it in the current layout (new and migrated tabs). */
function rebuildTab_(sh, name, rows) {
  var f = sh.getFilter();
  if (f) f.remove();
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).clearDataValidations();
  sh.clear();
  var cols = SCHEMA[name].cols;
  sh.getRange(1, 1, 1, cols.length).setValues([cols.map(function (c) { return c[1]; })]);
  if (rows.length) applyTable_(name, rows, [], true);
}

function writeLists_() {
  var ss = SS_(), sh = ss.getSheetByName('Lists') || ss.insertSheet('Lists');
  var n = LISTS.length;
  var head = LISTS.map(function (l) { return l[0]; }).concat(['All categories', 'Budget categories']);
  sh.getRange(1, 1, 1, head.length).setValues([head]);
  LISTS.forEach(function (l, i) {   // fill a list only while it's empty, so your own edits stay
    var col = sh.getRange(2, i + 1, Math.max(sh.getMaxRows() - 1, 1), 1).getValues();
    var used = col.some(function (r) { return str_(r[0]) !== ''; });
    if (!used || l[0] === 'Plan groups') sh.getRange(2, i + 1, l[1].length, 1).setValues(l[1].map(function (v) { return [v]; }));
  });
  var E = "'Expense Categories'!B2:B", I = "'Income Categories'!B2:B";
  sh.getRange(2, n + 1).setFormula('=IFERROR(FILTER({' + E + ';' + I + '},{' + E + ';' + I + '}<>""),"")');
  sh.getRange(2, n + 2).setFormula('={"' + ALL_SPENDING + '";IFERROR(FILTER(' + E + ',' + E + '<>""),"")}');
  styleLists_(sh, head.length);
}

var GUIDE = [
  ['h1', 'Badyet — your budget data'],
  ['p', 'This spreadsheet is where the Badyet app keeps everything. Changes you make here show up in the app within about 15 seconds, and the other way round.'],
  ['gap', ''],
  ['h2', 'How the tabs fit together'],
  ['p', '• Plan — your budget plan from the app’s guided setup: monthly income, the Needs / Wants / Savings split (in Settings), Debts (seated inside Needs with total debt, payoff months, payment frequency, and paid-so-far tracking that auto-removes when paid off), and Savings subcategories/goals. The Icon column holds the picture you chose in the app (you can leave it blank).'],
  ['p', '• Transactions — every peso in or out, including quick-tap entries from the 4 Tanks (Needs, Wants, Debts, Savings).'],
  ['p', '• Accounts — your banks, cash, e-wallets, credit cards and loans, with their starting balances.'],
  ['p', '• Expense Categories and Income Categories — the labels you sort money into. Tick Essential for needs like rent and groceries.'],
  ['p', '• Budgets — a spending limit per category per month (or week). Choose “All spending” for one overall limit. Tick Rollover to add last month’s leftover (or take off last month’s overspending).'],
  ['p', '• Bills — things that repeat, like salary, rent and subscriptions. “Next due” moves forward when you mark one paid in the app.'],
  ['p', '• Goals — what you’re saving for (linked to your Savings subcategories).'],
  ['p', '• Lists — the options in every dropdown. Add a payment method here and it appears everywhere.'],
  ['p', '• Settings — app preferences. “Budget month starts on day” lets budgets run payday to payday (e.g. 15).'],
  ['gap', ''],
  ['h2', 'Adding a row by hand'],
  ['p', '1. Go to the first empty row. Leave the ID cell blank: an ID is filled in for you.'],
  ['p', '2. Pick names from the dropdowns (category, account, type). The grey ID column next to each one fills in by itself.'],
  ['p', '3. Dates: double-click the cell for a calendar, or type 2026-11-10. Budget months are typed like 2026-11.'],
  ['p', '4. Amounts are plain numbers. No ₱ sign needed.'],
  ['gap', ''],
  ['h2', 'Good to know'],
  ['p', '• Grey columns are filled in automatically. You can leave them alone.'],
  ['p', '• Renaming an account or category is safe: rows are linked by ID, so every linked row updates.'],
  ['p', '• Delete a whole row to delete that record. Please don’t rename, reorder or delete the column headers.'],
  ['p', '• Something looks messy? Use the Badyet menu → Tidy up layout & look.'],
  ['p', '• Forgot the app PIN? Use the Badyet menu → Remove app PIN. The PIN itself is never stored in this sheet.']
];
function writeGuide_() {
  var ss = SS_(), sh = ss.getSheetByName('Guide') || ss.insertSheet('Guide');
  sh.clear();
  sh.getRange(1, 1, GUIDE.length, 1).setValues(GUIDE.map(function (g) { return [g[1]]; }));
  sh.setHiddenGridlines(true);
  sh.setTabColor('#000000');
  sh.setColumnWidth(1, 760);
  sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setFontFamily('Archivo').setFontColor('#000000').setVerticalAlignment('middle');
  GUIDE.forEach(function (g, i) {
    var c = sh.getRange(i + 1, 1).setWrap(true);
    if (g[0] === 'h1') { c.setFontSize(20).setFontWeight('bold'); sh.setRowHeight(i + 1, 48); }
    else if (g[0] === 'h2') { c.setFontSize(12).setFontWeight('bold'); sh.setRowHeight(i + 1, 30); }
    else if (g[0] === 'gap') sh.setRowHeight(i + 1, 12);
    else { c.setFontSize(10).setFontColor('#3d3d3d'); sh.setRowHeight(i + 1, 24); }
  });
}

function orderTabs_() {
  var ss = SS_();
  try {
    TAB_ORDER.forEach(function (t, i) {
      var sh = ss.getSheetByName(t);
      if (!sh) return;
      ss.setActiveSheet(sh);
      ss.moveActiveSheet(i + 1);
    });
    ss.setActiveSheet(ss.getSheetByName('Transactions'));
  } catch (x) {}
}

/* ================= Read ================= */
function lookup_(rows) {
  var byId = {}, byName = {};
  rows.forEach(function (r) {
    var id = str_(r.id), n = str_(r.name);
    if (!id || !n) return;
    byId[id] = n;
    if (!byName[n.toLowerCase()]) byName[n.toLowerCase()] = id;
  });
  return { byId: byId, byName: byName };
}

/* The name you picked wins; if that name no longer exists (it was renamed), the ID wins. */
function heal_(o, nk, ik, L, fix) {
  var nm = str_(o[nk]), id = str_(o[ik]), newId = id, newNm = nm;
  if (nm) {
    var found = L.byName[nm.toLowerCase()];
    if (found) { newId = found; newNm = L.byId[found]; }
    else if (id && L.byId[id]) newNm = L.byId[id];
  } else if (id && L.byId[id]) newNm = L.byId[id];
  if (newId !== id) { o[ik] = newId; fix(ik, newId); }
  if (newNm !== nm) { o[nk] = newNm; fix(nk, newNm); }
}

function readAll_() {
  ensureSheets_();
  var ss = SS_(), tz = ss.getSpreadsheetTimeZone(), T = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var t = SCHEMA[name], sh = ss.getSheetByName(t.title);
    var vals = sh.getDataRange().getValues();
    var head = (vals[0] || []).map(function (h) { return str_(h); });
    var map = headMap_(name, head), rows = [];
    for (var r = 1; r < vals.length; r++) {
      if (isEmptyRow_(vals[r])) continue;
      var o = {};
      t.cols.forEach(function (c) { var j = map[c[0]]; o[c[0]] = j === undefined ? '' : cell_(vals[r][j], c[2], tz); });
      o.__r = r + 1;
      rows.push(o);
    }
    T[name] = { sh: sh, map: map, rows: rows, fixes: [] };
  });

  // 1) rows typed in with a blank ID get one
  Object.keys(SCHEMA).forEach(function (name) {
    var t = SCHEMA[name], tb = T[name];
    if (!t.prefix) { tb.rows = tb.rows.filter(function (o) { return str_(o[t.key]); }); return; }
    tb.rows.forEach(function (o) {
      if (str_(o.id)) return;
      o.id = newId_(t.prefix);
      tb.fixes.push([o.__r, 'id', o.id]);
    });
  });

  // 2) keep each name/ID pair in step
  var L = { acc: lookup_(T.Accounts.rows), cat: lookup_(T.ExpenseCategories.rows.concat(T.IncomeCategories.rows)) };
  L.budcat = { byId: Object.assign({}, L.cat.byId), byName: Object.assign({}, L.cat.byName) };
  L.budcat.byId[ALL_SPENDING_ID] = ALL_SPENDING;
  L.budcat.byName[ALL_SPENDING.toLowerCase()] = ALL_SPENDING_ID;
  Object.keys(LINKS).forEach(function (name) {
    var tb = T[name];
    tb.rows.forEach(function (o) {
      LINKS[name].forEach(function (p) {
        heal_(o, p[0], p[1], L[p[2]], function (k, v) { tb.fixes.push([o.__r, k, v]); });
      });
    });
  });

  // 3) write fixes back, return clean rows
  var out = {};
  Object.keys(SCHEMA).forEach(function (name) {
    var tb = T[name];
    tb.fixes.forEach(function (f) {
      var j = tb.map[f[1]];
      if (j === undefined) return;
      tb.sh.getRange(f[0], j + 1).setNumberFormat('@').setValue(f[2]);
    });
    out[name] = tb.rows.map(function (o) { var c = {}; for (var k in o) if (k !== '__r') c[k] = o[k]; return c; });
  });
  try { out.__sheetUrl = ss.getUrl(); } catch (x) {}   // lets the app's "Open sheet" button find this sheet
  out.__pin = accountsOn_() ? false : pinOn_();
  out.__accountsOn = accountsOn_();
  if (CUR_ACCT_) {
    out.__account = { username: CUR_ACCT_.u, email: CUR_ACCT_.e, role: CUR_ACCT_.r };
    if (CUR_ACCT_.r === 'Admin') out.__accountsUrl = props_().getProperty(ACC_URL_KEY) || '';
  }
  return out;
}

/* ================= Write ================= */
function applyTable_(name, ups, dels, replaceAll) {
  var t = SCHEMA[name], ss = SS_(), sh = ss.getSheetByName(t.title);
  var tz = ss.getSpreadsheetTimeZone();
  var vals = sh.getDataRange().getValues();
  var head = (vals[0] || []).map(function (h) { return str_(h); });
  if (!head.some(function (h) { return h; })) head = [];
  var map = headMap_(name, head);
  t.cols.forEach(function (c) { if (map[c[0]] === undefined) { map[c[0]] = head.length; head.push(c[1]); } });
  var W = head.length, oldW = (vals[0] || []).length, oldN = Math.max(0, vals.length - 1);
  var kindAt = {};
  t.cols.forEach(function (c) { kindAt[map[c[0]]] = c[2]; });

  var rows = replaceAll ? [] : vals.slice(1).map(function (r) {
    r = r.map(function (v, j) { return cell_(v, kindAt[j] || 'text', tz); });
    while (r.length < W) r.push('');
    return r;
  });
  var k = map[t.key], del = {};
  (dels || []).forEach(function (x) { del[String(x)] = 1; });
  rows = rows.filter(function (r) { return !del[str_(r[k])]; });
  var pos = {};
  rows.forEach(function (r, i) { var key = str_(r[k]); if (key) pos[key] = i; });
  (ups || []).forEach(function (o) {
    var key = str_(o[t.key]);
    if (!key && t.prefix) key = newId_(t.prefix);
    if (!key) return;
    var r;
    if (Object.prototype.hasOwnProperty.call(pos, key)) r = rows[pos[key]];
    else { r = []; for (var i = 0; i < W; i++) r.push(''); rows.push(r); pos[key] = rows.length - 1; }
    t.cols.forEach(function (c) {
      if (c[0] === t.key) { r[map[c[0]]] = key; return; }
      if (Object.prototype.hasOwnProperty.call(o, c[0])) r[map[c[0]]] = cleanValue_(c[2], o[c[0]]);
    });
  });
  rows = rows.filter(function (r) { return !isEmptyRow_(r); });

  sh.getRange(1, 1, 1, W).setValues([head]);
  if (rows.length) {
    t.cols.forEach(function (c) {   // text-like columns stay text (an ID like 2E5 must not turn into a number)
      if (/^(id|text|note|sys|month|link|list)/.test(c[2])) sh.getRange(2, map[c[0]] + 1, rows.length, 1).setNumberFormat('@');
    });
    sh.getRange(2, 1, rows.length, W).setValues(rows);
    if (t.sort && map[t.sort.key] !== undefined && rows.length > 1) {
      sh.getRange(2, 1, rows.length, W).sort({ column: map[t.sort.key] + 1, ascending: t.sort.asc });
    }
  }
  if (oldN > rows.length) sh.getRange(rows.length + 2, 1, oldN - rows.length, Math.max(W, oldW)).clearContent();
}

/* ================= Menu & look ================= */
function onOpen() {
  var menu = SpreadsheetApp.getUi().createMenu('Badyet')
    .addItem('Tidy up layout & look', 'tidyUp')
    .addItem('Remove app PIN', 'removeAppPin');
  if (typeof fillDummyData === 'function') {
    menu.addSeparator()
      .addItem('Fill with dummy data', 'fillDummyData')
      .addItem('Clear all data (keep categories)', 'clearAllData');
  }
  menu.addToUi();
}

/* Rebuilds tabs that are missing or in an older layout, refreshes the Guide and
   Lists tabs, re-applies formatting and fills in missing IDs. Safe to run anytime. */
function tidyUp() {
  withLock_(function () { ensureSheets_(true); readAll_(); }, 25000);
  SpreadsheetApp.flush();
  try { SpreadsheetApp.getActive().toast('Layout and look tidied up.', 'Badyet', 6); } catch (e) {}
}
function applyMinimalTheme() { tidyUp(); }   // older menu name still works

function rangeFor_(kind) {
  var ss = SS_();
  if (kind === 'link:acc') return ss.getSheetByName('Accounts').getRange('B2:B');
  var lists = ss.getSheetByName('Lists'), n = LISTS.length;
  if (kind === 'link:cat') return lists.getRange(colLetter_(n) + '2:' + colLetter_(n));
  if (kind === 'link:budcat') return lists.getRange(colLetter_(n + 1) + '2:' + colLetter_(n + 1));
  var i = listIndex_(kind.slice(5));
  return i < 0 ? null : lists.getRange(colLetter_(i) + '2:' + colLetter_(i));
}

function baseLook_(sh, n) {
  sh.setHiddenGridlines(true);
  sh.setFrozenRows(1);
  sh.setTabColor('#000000');
  var rows = sh.getMaxRows(), body = Math.max(rows - 1, 1);
  sh.getRange(1, 1, rows, sh.getMaxColumns())
    .setFontFamily('Archivo').setFontSize(10).setFontColor('#000000').setVerticalAlignment('middle');
  sh.getRange(1, 1, 1, n).setBackground('#ffffff').setFontWeight('bold')
    .setBorder(null, null, true, null, null, null, '#000000', SpreadsheetApp.BorderStyle.SOLID_MEDIUM);
  sh.getRange(2, 1, body, n).setBackground(null)
    .setBorder(null, null, true, null, false, true, '#e6e6e6', SpreadsheetApp.BorderStyle.SOLID);
  sh.setRowHeight(1, 38);
  sh.setRowHeights(2, body, 30);
  return body;
}

function styleSheet_(sh, name) {
  if (!sh || !SCHEMA[name]) return;
  var cols = SCHEMA[name].cols, n = cols.length;
  var body = baseLook_(sh, n);
  cols.forEach(function (c, i) {
    var kind = c[2], col = sh.getRange(2, i + 1, body, 1), auto = /^(id|sys|linkid)/.test(kind);
    sh.setColumnWidth(i + 1, auto ? 112 : kind === 'note' ? 260 : /^(description|name|value)$/.test(c[0]) ? 220 : 130);
    col.clearDataValidations();
    if (auto) {
      col.setNumberFormat('@').setFontColor('#a3a3a3').setFontSize(9);
      sh.getRange(1, i + 1).setFontColor('#a3a3a3');
    } else if (kind === 'money') col.setNumberFormat('"₱"#,##0.00');
    else if (kind === 'number') col.setNumberFormat('0.##');
    else if (kind === 'date') {
      col.setNumberFormat('yyyy-mm-dd')
        .setDataValidation(SpreadsheetApp.newDataValidation().requireDate().setAllowInvalid(true).build());
    } else if (kind === 'bool') {
      col.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build()).setHorizontalAlignment('center');
    } else {
      col.setNumberFormat('@');
      if (kind === 'note') col.setFontColor('#737373');
      if (kind.indexOf('list:') === 0 || kind.indexOf('link:') === 0) {
        var src = rangeFor_(kind);
        if (src) col.setDataValidation(SpreadsheetApp.newDataValidation().requireValueInRange(src, true).setAllowInvalid(true).build());
      }
    }
  });
  if (!sh.getFilter()) sh.getRange(1, 1, sh.getMaxRows(), n).createFilter();
}

function styleLists_(sh, n) {
  baseLook_(sh, n);
  for (var i = 1; i <= n; i++) sh.setColumnWidth(i, 150);
  sh.getRange(1, n - 1, Math.max(sh.getMaxRows(), 1), 2).setFontColor('#a3a3a3');
}

/* Run once from the editor (select "testSetup" > Run) to build the tabs and
   grant permissions before deploying. */
function testSetup() {
  tidyUp();
  Logger.log(JSON.stringify(apiGet()).slice(0, 500));
}
/* ================= ACCOUNTS (sign up, email code, log in) =================
   Off until you turn it on in the app (Settings → Accounts). Then:
   • A "Badyet Accounts" spreadsheet in your Drive lists every account.
   • Passwords are never stored: only a salted hash, repeated many times.
   • Codes are 6 digits, sent by email, valid 10 minutes, 5 tries, one use.
   • Each person gets their own budget spreadsheet, shared with their email.
   • You (the admin) keep this sheet as your own account.                  */
var ACC_KEY = 'BADYET_ACCOUNTS_ID', ACC_URL_KEY = 'BADYET_ACCOUNTS_URL', ENABLE_KEY = 'BADYET_ENABLE';
var SESSION_PREFIX = 'BADYET_S_', LOGINFAIL_PREFIX = 'BADYET_LF_';
var ACC_COLS = ['Username', 'Email', 'Role', 'Verified', 'Joined', 'Last login', 'Budget sheet', 'Sheet ID', 'Password hash', 'Salt'];
var CODE_COLS = ['Email', 'Purpose', 'Code hash', 'Salt', 'Expires', 'Tries', 'Sent', 'Data'];
var LOG_COLS = ['Time', 'Username', 'Event'];
var CODE_MIN = 10, CODE_TRIES = 5, RESEND_SEC = 45, PW_ROUNDS = 1500;
var LOGIN_TRIES = 5, LOGIN_WAIT_MIN = 5, KEEP_DAYS = 30, SHORT_HOURS = 12;

function accountsOn_() { return !!props_().getProperty(ACC_KEY); }
function accDb_() { return SpreadsheetApp.openById(props_().getProperty(ACC_KEY)); }
function accTab_(db, name, cols) {
  var sh = db.getSheetByName(name);
  if (!sh) { sh = db.insertSheet(name); sh.getRange(1, 1, 1, cols.length).setValues([cols]); try { sh.setFrozenRows(1); } catch (e) {} }
  return sh;
}
function tabRows_(sh) {
  var v = sh.getDataRange().getValues(), h = v[0] || [], out = [];
  for (var r = 1; r < v.length; r++) {
    if (isEmptyRow_(v[r])) continue;
    var o = { __r: r + 1 };
    h.forEach(function (k, i) { o[k] = v[r][i]; });
    out.push(o);
  }
  return out;
}
function putRow_(sh, cols, o, rowNum) {   // everything stored as plain text, so codes and hashes never get "helped" by Sheets
  var r = rowNum || (sh.getLastRow() + 1);
  var rg = sh.getRange(r, 1, 1, cols.length);
  rg.setNumberFormat('@');
  rg.setValues([cols.map(function (k) { return o[k] === undefined || o[k] === null ? '' : String(o[k]); })]);
  return r;
}
function dropRow_(sh, r) { sh.deleteRow(r); }
function nowIso_() { return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm"); }
function logEvent_(username, event) {
  try { putRow_(accTab_(accDb_(), 'Sign-in log', LOG_COLS), LOG_COLS, { 'Time': nowIso_(), 'Username': username, 'Event': event }); } catch (e) {}
}

/* ---- rules (the app checks the same things, the server has the final say) ---- */
function normUser_(u) { return str_(u).toLowerCase(); }
function normEmail_(e) { return str_(e).toLowerCase(); }
function userErr_(u) { return /^[a-z0-9_]{3,20}$/.test(u) ? '' : 'Use 3 to 20 letters, numbers or _ (no spaces).'; }
function emailErr_(e) { return (e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) ? '' : 'That email doesn’t look right.'; }
function passErr_(p, u, e) {
  p = String(p == null ? '' : p);
  if (p.length < 8) return 'Use at least 8 characters.';
  if (p.length > 128) return 'That password is too long.';
  if (!/\d/.test(p)) return 'Add at least one number.';
  var low = p.toLowerCase();
  if ((u && low.indexOf(u) >= 0) || (e && (low === e || low.indexOf(e.split('@')[0]) >= 0 && e.split('@')[0].length >= 4))) return 'Don’t use your username or email in it.';
  return '';
}
function pwHash_(salt, pw) {
  var h = salt + ':' + pw;
  for (var i = 0; i < PW_ROUNDS; i++) h = hash_(salt, h + ':' + pw);
  return h;
}
function salt_() { return Utilities.getUuid().replace(/-/g, ''); }
function newCode_() { return ('00000' + (parseInt(Utilities.getUuid().replace(/-/g, '').slice(0, 8), 16) % 1000000)).slice(-6); }
function mask_(e) { var p = e.split('@'); return p[0].charAt(0) + '••••@' + (p[1] || ''); }
function tokHash_(t) { return hash_('badyet-session', String(t)).slice(0, 40); }

/* ---- accounts ---- */
function findAcct_(id) {   // by username or email
  id = str_(id).toLowerCase();
  if (!id) return null;
  var rows = tabRows_(accTab_(accDb_(), 'Accounts', ACC_COLS));
  for (var i = 0; i < rows.length; i++) {
    if (str_(rows[i].Username).toLowerCase() === id || str_(rows[i].Email).toLowerCase() === id) return rows[i];
  }
  return null;
}
function openUserSheet_(sid) {
  var a = SpreadsheetApp.getActive();
  if (a && a.getId() === sid) return a;
  return SpreadsheetApp.openById(sid);
}

/* ---- sessions (one per phone, kept in script properties as a hash of the key) ---- */
function newSession_(acct, keep) {
  var tok = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
  var s = { u: str_(acct.Username), e: str_(acct.Email), r: str_(acct.Role) || 'Member', sid: str_(acct['Sheet ID']),
            exp: Date.now() + (keep === false ? SHORT_HOURS * 3600000 : KEEP_DAYS * 86400000) };
  props_().setProperty(SESSION_PREFIX + tokHash_(tok), JSON.stringify(s));
  return { token: tok, expires: s.exp };
}
function sessionOf_(tok) {
  if (!tok) return null;
  var key = SESSION_PREFIX + tokHash_(tok), raw = props_().getProperty(key);
  if (!raw) return null;
  var s; try { s = JSON.parse(raw); } catch (e) { return null; }
  if (!(s.exp > Date.now())) { props_().deleteProperty(key); return null; }
  s.key = key;
  return s;
}
function endSessions_(username, keepKey) {
  var all = props_().getProperties();
  Object.keys(all).forEach(function (k) {
    if (k.indexOf(SESSION_PREFIX) !== 0 || k === keepKey) return;
    try { var s = JSON.parse(all[k]); if (s.u === username || !(s.exp > Date.now())) props_().deleteProperty(k); } catch (e) { props_().deleteProperty(k); }
  });
}
/* Every data request passes through here. Returns null when it may go ahead. */
function gate_(token) {
  CUR_SS_ = null; CUR_ACCT_ = null;
  if (!accountsOn_()) return unlocked_(token) ? null : locked_();
  var s = sessionOf_(token);
  if (!s) return { __auth: true, __accountsOn: true };
  CUR_ACCT_ = s;
  CUR_SS_ = openUserSheet_(s.sid);
  return null;
}
function userInfo_(s, url) { return { username: s.u, email: s.e, role: s.r, sheetUrl: url || '' }; }

/* ---- login throttling (per username/email, known or not, so nobody can tell which exist) ---- */
function failState_(id) { try { return JSON.parse(props_().getProperty(LOGINFAIL_PREFIX + tokHash_(id)) || '{}'); } catch (e) { return {}; } }
function setFail_(id, st) { if (st) props_().setProperty(LOGINFAIL_PREFIX + tokHash_(id), JSON.stringify(st)); else props_().deleteProperty(LOGINFAIL_PREFIX + tokHash_(id)); }

/* ---- codes ---- */
function codeTab_() { return accTab_(accDb_(), 'Codes', CODE_COLS); }
function findCode_(email, purpose) {
  var rows = tabRows_(codeTab_());
  for (var i = rows.length - 1; i >= 0; i--) if (str_(rows[i].Email) === email && str_(rows[i].Purpose) === purpose) return rows[i];
  return null;
}
function mailCode_(email, code, purpose) {
  if (MailApp.getRemainingDailyQuota() < 1) throw new Error('QUOTA');
  var what = purpose === 'reset' ? 'reset your password' : 'verify your email';
  MailApp.sendEmail({
    to: email, name: 'Badyet', subject: code + ' is your Badyet code',
    body: 'Your Badyet code is ' + code + '. Use it to ' + what + '. It expires in ' + CODE_MIN + ' minutes. If you didn’t ask for this, you can ignore this email.',
    htmlBody: '<div style="font-family:Arial,Helvetica,sans-serif;max-width:420px;color:#0a0a0a">' +
      '<h2 style="margin:0 0 8px;font-size:22px">Your Badyet code</h2><p style="margin:0 0 6px">Use this code to ' + what + ':</p>' +
      '<p style="font-size:34px;font-weight:bold;letter-spacing:8px;margin:14px 0">' + code + '</p>' +
      '<p style="color:#6b6b6b;font-size:13px">It expires in ' + CODE_MIN + ' minutes and works once. If you didn’t ask for this, you can ignore this email.</p></div>'
  });
}
/* Save (or replace) a code for this email + purpose and email it. data = what to do once it's verified. */
function issueCode_(email, purpose, data, store) {
  var prev = store.get(email, purpose);
  if (prev && Date.now() - (+prev.Sent || 0) < RESEND_SEC * 1000) {
    return { ok: false, error: 'Please wait a moment before asking for another code.', wait: Math.ceil((RESEND_SEC * 1000 - (Date.now() - (+prev.Sent))) / 1000) };
  }
  var code = newCode_(), salt = salt_();
  var row = { 'Email': email, 'Purpose': purpose, 'Code hash': hash_(salt, code), 'Salt': salt, 'Expires': Date.now() + CODE_MIN * 60000,
              'Tries': 0, 'Sent': Date.now(), 'Data': data ? JSON.stringify(data) : '' };
  try { mailCode_(email, code, purpose); }
  catch (e) { return { ok: false, error: String(e.message) === 'QUOTA' ? 'Too many emails were sent today. Please try again tomorrow.' : 'Couldn’t send the email: ' + (e.message || e) }; }
  store.put(row, prev);
  return { ok: true, sentTo: mask_(email), expiresIn: CODE_MIN * 60, resendIn: RESEND_SEC };
}
/* Check a code. Wrong guesses are counted; the code is removed after 5 or once used. */
function checkCode_(email, purpose, code, store, consume) {
  var row = store.get(email, purpose);
  if (!row) return { ok: false, field: 'code', error: 'That code has expired. Ask for a new one.', expired: true };
  if (!(+row.Expires > Date.now())) { store.drop(row); return { ok: false, field: 'code', error: 'That code has expired. Ask for a new one.', expired: true }; }
  if (hash_(str_(row.Salt), str_(code)) !== str_(row['Code hash'])) {
    var tries = (+row.Tries || 0) + 1;
    if (tries >= CODE_TRIES) { store.drop(row); return { ok: false, field: 'code', error: 'Too many wrong tries. Ask for a new code.', expired: true }; }
    row.Tries = tries; store.put(row, row);
    return { ok: false, field: 'code', error: 'That code isn’t right.', left: CODE_TRIES - tries };
  }
  if (consume !== false) store.drop(row);
  var data = {}; try { data = JSON.parse(str_(row.Data) || '{}'); } catch (e) {}
  return { ok: true, data: data, row: row };
}
var SHEET_STORE = {
  get: function (email, purpose) { return findCode_(email, purpose); },
  put: function (row, prev) { var sh = codeTab_(); putRow_(sh, CODE_COLS, row, prev && prev.__r); },
  drop: function (row) { if (row && row.__r) dropRow_(codeTab_(), row.__r); }
};
var ENABLE_STORE = {   // before the accounts sheet exists, the admin's code waits in script properties
  get: function (email, purpose) { try { var r = JSON.parse(props_().getProperty(ENABLE_KEY) || 'null'); return r && r.Email === email && r.Purpose === purpose ? r : null; } catch (e) { return null; } },
  put: function (row) { var c = {}; CODE_COLS.forEach(function (k) { c[k] = row[k]; }); props_().setProperty(ENABLE_KEY, JSON.stringify(c)); },
  drop: function () { props_().deleteProperty(ENABLE_KEY); }
};

/* ---- creating things ---- */
function makeUserSheet_(username, email) {
  var ss = SpreadsheetApp.create('Badyet – ' + username), shared = false;
  try { ss.setSpreadsheetTimeZone(SpreadsheetApp.getActive().getSpreadsheetTimeZone()); } catch (e) {}
  var keep = CUR_SS_; CUR_SS_ = ss;
  try { ensureSheets_(true); } finally { CUR_SS_ = keep; }
  try { ss.addEditor(email); shared = true; } catch (e) {}
  return { id: ss.getId(), url: ss.getUrl(), name: 'Badyet – ' + username, shared: shared };
}
function createAccountsDb_() {
  var db = SpreadsheetApp.create('Badyet Accounts');
  accTab_(db, 'Accounts', ACC_COLS); accTab_(db, 'Codes', CODE_COLS); accTab_(db, 'Sign-in log', LOG_COLS);
  var s1 = db.getSheetByName('Sheet1'); if (s1) { try { db.deleteSheet(s1); } catch (e) {} }
  props_().setProperty(ACC_KEY, db.getId());
  props_().setProperty(ACC_URL_KEY, db.getUrl());
  return db;
}

/* ================= The one entry point the app calls for everything account-related ================= */
function apiAuth(op, p, token) {
  p = p || {};
  try {
    return withLock_(function () { return authOp_(op, p, token); }, 20000);
  } catch (e) {
    return { ok: false, error: 'Something went wrong on Google’s side: ' + (e && e.message || e) };
  }
}
function authOp_(op, p, token) {
  var on = accountsOn_();
  if (op === 'status') {
    var s0 = on ? sessionOf_(token) : null;
    return { ok: true, accountsOn: on, user: s0 ? userInfo_(s0) : null };
  }

  /* ---- turning accounts on (owner only: needs this device to already have access) ---- */
  if (op === 'enable' || op === 'enable_verify') {
    if (on) return { ok: false, error: 'Accounts are already on.' };
    if (!unlocked_(token)) return { ok: false, error: 'Unlock the app with your PIN first.' };
    var eu = normUser_(p.username), ee = normEmail_(p.email);
    if (op === 'enable') {
      var e1 = userErr_(eu) || '', e2 = emailErr_(ee) || '', e3 = passErr_(p.password, eu, ee) || '';
      if (e1) return { ok: false, field: 'username', error: e1 };
      if (e2) return { ok: false, field: 'email', error: e2 };
      if (e3) return { ok: false, field: 'password', error: e3 };
      var salt = salt_();
      return issueCode_(ee, 'enable', { u: eu, h: pwHash_(salt, String(p.password)), s: salt, keep: p.keep !== false }, ENABLE_STORE);
    }
    var ck = checkCode_(ee, 'enable', p.code, ENABLE_STORE);
    if (!ck.ok) return ck;
    createAccountsDb_();
    var me = SpreadsheetApp.getActive();
    var admin = { 'Username': ck.data.u, 'Email': ee, 'Role': 'Admin', 'Verified': 'Yes', 'Joined': nowIso_(), 'Last login': nowIso_(),
                  'Budget sheet': me.getName ? me.getName() : 'Badyet', 'Sheet ID': me.getId(), 'Password hash': ck.data.h, 'Salt': ck.data.s };
    putRow_(accTab_(accDb_(), 'Accounts', ACC_COLS), ACC_COLS, admin);
    [PIN_KEY, TOK_KEY, FAIL_KEY].forEach(function (k) { props_().deleteProperty(k); });   // the password replaces the PIN
    logEvent_(admin.Username, 'Turned on accounts (admin)');
    var ses = newSession_(admin, ck.data.keep);
    return { ok: true, token: ses.token, user: { username: admin.Username, email: ee, role: 'Admin', sheetUrl: me.getUrl() }, shared: true, admin: true };
  }

  if (!on) return { ok: false, error: 'Accounts aren’t turned on yet.' };

  if (op === 'signup') {
    var u = normUser_(p.username), em = normEmail_(p.email);
    var bad = userErr_(u); if (bad) return { ok: false, field: 'username', error: bad };
    bad = emailErr_(em); if (bad) return { ok: false, field: 'email', error: bad };
    bad = passErr_(p.password, u, em); if (bad) return { ok: false, field: 'password', error: bad };
    if (findAcct_(u)) return { ok: false, field: 'username', error: 'That username is taken.', taken: true,
      suggest: [u + '_2', u + '_' + (new Date().getFullYear() % 100), u + '_3'].filter(function (x) { return !userErr_(x) && !findAcct_(x); }).slice(0, 2) };
    if (findAcct_(em)) return { ok: false, field: 'email', error: 'This email already has an account.', emailUsed: true };
    var sl = salt_();
    return issueCode_(em, 'signup', { u: u, h: pwHash_(sl, String(p.password)), s: sl, keep: p.keep !== false }, SHEET_STORE);
  }
  if (op === 'resend') {   // purpose: signup | reset
    var re = normEmail_(p.email), pur = p.purpose === 'reset' ? 'reset' : p.purpose === 'enable' ? 'enable' : 'signup';
    var store = pur === 'enable' ? ENABLE_STORE : SHEET_STORE, old = store.get(re, pur);
    if (!old) return { ok: false, error: 'Start again: that request has expired.', expired: true };
    var d0 = {}; try { d0 = JSON.parse(str_(old.Data) || '{}'); } catch (e) {}
    return issueCode_(re, pur, d0, store);
  }
  if (op === 'verify') {
    var ve = normEmail_(p.email);
    var ck2 = checkCode_(ve, 'signup', p.code, SHEET_STORE);
    if (!ck2.ok) return ck2;
    var vu = ck2.data.u;
    if (findAcct_(vu)) return { ok: false, field: 'username', error: 'Someone just took that username. Please pick another.', restart: true };
    if (findAcct_(ve)) return { ok: false, field: 'email', error: 'This email already has an account.', restart: true };
    var made = makeUserSheet_(vu, ve);
    var acct = { 'Username': vu, 'Email': ve, 'Role': 'Member', 'Verified': 'Yes', 'Joined': nowIso_(), 'Last login': nowIso_(),
                 'Budget sheet': made.name, 'Sheet ID': made.id, 'Password hash': ck2.data.h, 'Salt': ck2.data.s };
    putRow_(accTab_(accDb_(), 'Accounts', ACC_COLS), ACC_COLS, acct);
    logEvent_(vu, 'Signed up');
    var ses2 = newSession_(acct, ck2.data.keep);
    return { ok: true, token: ses2.token, user: { username: vu, email: ve, role: 'Member', sheetUrl: made.url, sheetName: made.name }, shared: made.shared };
  }
  if (op === 'login') {
    var id = str_(p.id).toLowerCase();
    if (!id || !p.password) return { ok: false, error: 'Enter your username or email and your password.' };
    var a = findAcct_(id), fkey = a ? str_(a.Username).toLowerCase() : id;   // username and email share one counter
    var st = failState_(fkey);
    if (st.until && st.until > Date.now()) return { ok: false, error: 'Too many wrong tries.', wait: Math.ceil((st.until - Date.now()) / 1000) };
    if (!a || str_(a.Verified) !== 'Yes' || pwHash_(str_(a.Salt), String(p.password)) !== str_(a['Password hash'])) {
      var n = (st.n || 0) + 1;
      if (n >= LOGIN_TRIES) { setFail_(fkey, { n: 0, until: Date.now() + LOGIN_WAIT_MIN * 60000 }); if (a) logEvent_(str_(a.Username), 'Login paused after 5 wrong passwords'); return { ok: false, error: 'Too many wrong tries.', wait: LOGIN_WAIT_MIN * 60 }; }
      setFail_(fkey, { n: n });
      return { ok: false, error: 'Wrong username, email or password.', left: LOGIN_TRIES - n };
    }
    setFail_(fkey, null);
    var sh = accTab_(accDb_(), 'Accounts', ACC_COLS); a['Last login'] = nowIso_(); putRow_(sh, ACC_COLS, a, a.__r);
    logEvent_(str_(a.Username), 'Logged in');
    var ses3 = newSession_(a, p.keep);
    return { ok: true, token: ses3.token, user: { username: str_(a.Username), email: str_(a.Email), role: str_(a.Role) } };
  }
  if (op === 'logout') {
    var s1 = sessionOf_(token);
    if (s1) { props_().deleteProperty(s1.key); logEvent_(s1.u, 'Logged out'); }
    return { ok: true };
  }
  if (op === 'forgot') {   // same answer whether or not the email has an account
    var fe = normEmail_(p.email);
    if (emailErr_(fe)) return { ok: false, field: 'email', error: emailErr_(fe) };
    var fa = findAcct_(fe);
    if (fa && str_(fa.Email).toLowerCase() === fe) {
      var r = issueCode_(fe, 'reset', { u: str_(fa.Username) }, SHEET_STORE);
      if (!r.ok && !r.wait) return r;
    }
    return { ok: true, sentTo: mask_(fe), expiresIn: CODE_MIN * 60, resendIn: RESEND_SEC };
  }
  if (op === 'reset_check') {   // right code → a short-lived ticket to set the new password
    var ce = normEmail_(p.email);
    var ck3 = checkCode_(ce, 'reset', p.code, SHEET_STORE, false);
    if (!ck3.ok) return ck3;
    var ticket = (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
    ck3.row.Data = JSON.stringify({ u: ck3.data.u, t: hash_('ticket', ticket) });
    ck3.row['Code hash'] = 'used'; ck3.row.Expires = Date.now() + CODE_MIN * 60000;
    SHEET_STORE.put(ck3.row, ck3.row);
    return { ok: true, ticket: ticket };
  }
  if (op === 'reset') {
    var te = normEmail_(p.email), row = SHEET_STORE.get(te, 'reset');
    var dd = {}; try { dd = JSON.parse(str_(row && row.Data) || '{}'); } catch (e) {}
    if (!row || !(+row.Expires > Date.now()) || !dd.t || dd.t !== hash_('ticket', str_(p.ticket))) return { ok: false, error: 'That reset link has expired. Ask for a new code.', expired: true };
    var ra = findAcct_(dd.u);
    if (!ra) return { ok: false, error: 'That account no longer exists.' };
    var pe = passErr_(p.password, str_(ra.Username), str_(ra.Email)); if (pe) return { ok: false, field: 'password', error: pe };
    if (pwHash_(str_(ra.Salt), String(p.password)) === str_(ra['Password hash'])) return { ok: false, field: 'password', error: 'Pick a password you haven’t used for this account.' };
    var ns = salt_(); ra.Salt = ns; ra['Password hash'] = pwHash_(ns, String(p.password)); ra['Last login'] = nowIso_();
    putRow_(accTab_(accDb_(), 'Accounts', ACC_COLS), ACC_COLS, ra, ra.__r);
    SHEET_STORE.drop(row);
    endSessions_(str_(ra.Username));   // log out everywhere else
    setFail_(str_(ra.Username).toLowerCase(), null);
    logEvent_(str_(ra.Username), 'Reset password');
    var ses4 = newSession_(ra, true);
    return { ok: true, token: ses4.token, user: { username: str_(ra.Username), email: str_(ra.Email), role: str_(ra.Role) } };
  }
  if (op === 'change_password') {
    var s2 = sessionOf_(token);
    if (!s2) return { ok: false, error: 'Please log in again.', auth: true };
    var ca = findAcct_(s2.u);
    if (!ca || pwHash_(str_(ca.Salt), String(p.current || '')) !== str_(ca['Password hash'])) return { ok: false, field: 'current', error: 'Your current password isn’t right.' };
    var ce2 = passErr_(p.password, str_(ca.Username), str_(ca.Email)); if (ce2) return { ok: false, field: 'password', error: ce2 };
    if (String(p.password) === String(p.current)) return { ok: false, field: 'password', error: 'Pick a new password.' };
    var ns2 = salt_(); ca.Salt = ns2; ca['Password hash'] = pwHash_(ns2, String(p.password));
    putRow_(accTab_(accDb_(), 'Accounts', ACC_COLS), ACC_COLS, ca, ca.__r);
    endSessions_(s2.u, s2.key);   // other phones are logged out, this one stays in
    logEvent_(s2.u, 'Changed password');
    return { ok: true };
  }
  return { ok: false, error: 'Unknown request.' };
}
