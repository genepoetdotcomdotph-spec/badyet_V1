/**
 * BADYET — DUMMY DATA FILLER
 * ------------------------------------------------------------------
 * Fills your sheet with 6 months of realistic sample data
 * (accounts, transactions, bills, budgets, goals, plan with debt, categories).
 *
 * HOW TO USE
 * 1. Open your Google Sheet > Extensions > Apps Script.
 * 2. Next to "Files" on the left, click "+" > Script. Name it DemoData.
 * 3. Paste this whole file in, press Ctrl+S (Cmd+S on Mac).
 * 4. In the toolbar, pick "fillDummyData" from the function dropdown, click Run.
 *    (First time: Google asks for permission > Advanced > Go to project > Allow.)
 * 5. Reload your Google Sheet: the "Badyet" menu at the top now also has
 *    "Fill with dummy data" and "Clear all data".
 *
 * This file needs the Badyet bridge script (Code.gs) in the same project.
 * You do NOT need to re-deploy after adding this file.
 * WARNING: filling REPLACES everything currently in the Badyet tabs.
 */

/* The "Badyet" menu itself now lives in Code.gs. */

function fillDummyData() {
  if (!confirm_('Fill with dummy data?', 'This REPLACES everything in the Badyet tabs with 6 months of sample data.')) return;
  writeAll_(buildDemoRows_());
  notify_('Done! Sample data added. The Badyet app updates within about 15 seconds.');
}

function clearAllData() {
  if (!confirm_('Clear all data?', 'This deletes all accounts, transactions, bills, budgets and goals. Categories are kept.')) return;
  var demo = buildDemoRows_();
  var ss = SpreadsheetApp.getActive();
  ['ExpenseCategories', 'IncomeCategories'].forEach(function (t) {   // keep your own categories
    var sh = ss.getSheetByName(SCHEMA[t].title);
    if (sh && sh.getLastRow() > 1) delete demo[t];
  });
  writeAll_({
    ExpenseCategories: demo.ExpenseCategories, IncomeCategories: demo.IncomeCategories,
    Accounts: [], Transactions: [], Budgets: [], Bills: [], Goals: [], Plan: [], Settings: demoSettings_(false)
  });
  notify_('All data cleared. The Badyet app updates within about 15 seconds.');
}

/* ---------------- helpers ---------------- */
function confirm_(title, msg) {
  var ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { return true; } // run from editor: no popup available
  return ui.alert(title, msg, ui.ButtonSet.YES_NO) === ui.Button.YES;
}
function notify_(msg) {
  try { SpreadsheetApp.getActive().toast(msg, 'Badyet', 8); } catch (e) {}
  Logger.log(msg);
}
function writeAll_(data) {
  if (typeof ensureSheets_ !== 'function' || typeof applyTable_ !== 'function') {
    throw new Error('The Badyet bridge script (Code.gs) must be in this same Apps Script project.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(25000);
  try {
    ensureSheets_();
    Object.keys(SCHEMA).forEach(function (name) {
      if (data[name]) applyTable_(name, data[name], [], true);   // a missing table is left as it is
    });
    SpreadsheetApp.flush();
    readAll_();   // fills in every ID and linked name
  } finally {
    lock.releaseLock();
  }
}

function demoSettings_(isDemo) {
  return [
    { key: 'Date format', value: 'MMM d, yyyy', note: 'How dates are shown in the app.' },
    { key: 'Home period', value: 'month', note: 'Which period the home screen shows first.' },
    { key: 'Budget warning at (%)', value: '80', note: 'A budget is flagged once this share of it is used.' },
    { key: 'Budget limit at (%)', value: '100', note: 'A budget counts as over once this share is used.' },
    { key: 'Budget month starts on day', value: '1', note: '1 = calendar month. Set it to your payday (e.g. 15) so budgets run payday to payday.' },
    { key: 'Monthly income (plan)', value: isDemo ? '60000' : '', note: 'Your take-home pay per month. Set up in the app under Budgets \u2192 Edit Plan.' },
    { key: 'Plan split (Needs / Wants / Savings %)', value: isDemo ? '50 / 30 / 20' : '', note: 'Three numbers that add up to 100, e.g. 50 / 30 / 20.' },
    { key: 'Payday', value: isDemo ? '15th & 30th' : '', note: '1st, 15th & 30th, Every 2 weeks, or a day of the month (e.g. 10).' },
    { key: 'Demo data', value: isDemo ? 'TRUE' : 'FALSE', note: 'TRUE while the sample data is loaded.' },
    { key: 'Dismissed alerts', value: '', note: 'Alerts you closed in the app (kept by the app).' },
    { key: 'Ignored in checks', value: '', note: 'Transactions excluded from unusual-spending checks (kept by the app).' }
  ];
}

function buildDemoRows_() {
  var tz = SpreadsheetApp.getActive().getSpreadsheetTimeZone();
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  var TY = +today.slice(0, 4), TM = +today.slice(5, 7), TD = +today.slice(8, 10);

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dim(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function ymd(y, m, d) { return y + '-' + pad(m) + '-' + pad(Math.min(d, dim(y, m))); }
  function addMonths(y, m, n) { var t = y * 12 + (m - 1) + n; return [Math.floor(t / 12), (t % 12) + 1]; }
  function addDays(iso, n) {
    var d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10) + n));
    return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  }
  function id(p) { return newId_(p); }
  function rnd(a, b) { return Math.round(a + Math.random() * (b - a)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  var start = addMonths(TY, TM, -6);
  var openDate = addDays(ymd(start[0], start[1], 1), -5);

  /* ---------- Accounts ---------- */
  var BPI = 'BPI Payroll', CASH = 'Cash Wallet', GC = 'GCash', SAV = 'BPI Savings', CC = 'RCBC Gold Card', LOAN = 'Personal / Credit Debt';
  var Accounts = [
    { id: id('ACC'), name: BPI, type: 'bank', openingBalance: 25000, openingDate: openDate, notes: 'Main salary account', archived: false, apr: '', minPayment: '', dueDay: '', plannedPayment: '' },
    { id: id('ACC'), name: CASH, type: 'cash', openingBalance: 2500, openingDate: openDate, notes: '', archived: false, apr: '', minPayment: '', dueDay: '', plannedPayment: '' },
    { id: id('ACC'), name: GC, type: 'ewallet', openingBalance: 1200, openingDate: openDate, notes: '', archived: false, apr: '', minPayment: '', dueDay: '', plannedPayment: '' },
    { id: id('ACC'), name: SAV, type: 'savings', openingBalance: 20000, openingDate: openDate, notes: 'Emergency fund parking', archived: false, apr: '', minPayment: '', dueDay: '', plannedPayment: '' },
    { id: id('ACC'), name: CC, type: 'credit', openingBalance: 0, openingDate: openDate, notes: '', archived: false, apr: 36, minPayment: 2500, dueDay: 22, plannedPayment: 5000 },
    { id: id('ACC'), name: LOAN, type: 'loan', openingBalance: 30000, openingDate: openDate, notes: '6-month payoff plan (₱30,000)', archived: false, apr: 0, minPayment: 5000, dueDay: 5, plannedPayment: 5000 }
  ];

  /* ---------- Bills (recurring schedules) ---------- */
  function bill(desc, type, amount, cat, acc, day) {
    return { id: id('BIL'), description: desc, type: type, amount: amount, category: cat, account: acc,
             frequency: 'monthly', startDate: ymd(start[0], start[1], day), endDate: '', nextDue: '', status: 'active', _day: day };
  }
  var B = {
    sal15: bill('Salary (15th)', 'income', 30000, 'Salary', BPI, 15),
    sal30: bill('Salary (30th)', 'income', 30000, 'Salary', BPI, 30),
    free:  bill('Freelance project', 'income', 6500, 'Freelance', GC, 20),
    rent:  bill('Rent - Casa Verde unit', 'expense', 12500, 'Housing & Rent', BPI, 3),
    net:   bill('Converge fiber internet', 'expense', 1299, 'Utilities', BPI, 8),
    mer:   bill('Meralco electricity', 'expense', 2150, 'Utilities', BPI, 10),
    wat:   bill('Maynilad water', 'expense', 380, 'Utilities', BPI, 10),
    phone: bill('Globe postpaid', 'expense', 999, 'Utilities', GC, 20),
    nfx:   bill('Netflix', 'expense', 549, 'Subscriptions', CC, 14),
    spot:  bill('Spotify', 'expense', 149, 'Subscriptions', GC, 21),
    ins:   bill('Sun Life insurance', 'expense', 1150, 'Healthcare', GC, 17),
    loani: bill('Auto loan interest', 'expense', 850, 'Debt Interest', BPI, 5)
  };

  /* ---------- Transactions ---------- */
  var Tx = [], cardOwed = 0;
  function tx(date, type, desc, amount, cat, from, to, extra) {
    if (date > today) return;
    var r = { id: id('TXN'), date: date, type: type, description: desc, amount: amount, category: cat || '',
              fromAccount: from || '', toAccount: to || '', method: '', notes: '', tags: '', recurringId: '', refundOf: '' };
    for (var k in (extra || {})) r[k] = extra[k];
    if (type === 'expense' && from === CC) cardOwed += amount;
    if (type === 'cc_payment' && to === CC) cardOwed -= amount;
    Tx.push(r);
  }
  function fromBill(b, y, m, amount, extra) {
    extra = extra || {}; extra.recurringId = b.id;
    if (b.type === 'income') tx(ymd(y, m, b._day), 'income', b.description, amount || b.amount, b.category, '', b.account, extra);
    else tx(ymd(y, m, b._day), 'expense', b.description, amount || b.amount, b.category, b.account, '', extra);
  }

  var GROC = ['Puregold', 'SM Supermarket', 'Landers', 'Walter Mart'];
  var FOOD = ['Jollibee', "McDonald's", 'Foodpanda', 'Starbucks', 'Chowking', 'Greenwich', 'Mang Inasal'];

  for (var i = 0; i <= 6; i++) {
    var ym = addMonths(start[0], start[1], i), y = ym[0], m = ym[1];
    var last = (y === TY && m === TM) ? TD : dim(y, m);
    function d(n) { return ymd(y, m, n); }

    fromBill(B.sal15, y, m, null, { method: 'Bank Transfer' });
    fromBill(B.sal30, y, m, null, { method: 'Bank Transfer' });
    fromBill(B.free, y, m, Math.round(rnd(5000, 9500) / 250) * 250);
    fromBill(B.rent, y, m, null, { method: 'Autopay' });
    fromBill(B.net, y, m, null, { method: 'Autopay' });
    fromBill(B.mer, y, m, rnd(1600, 2800));
    fromBill(B.wat, y, m, null, { method: 'Autopay' });
    fromBill(B.phone, y, m, null, { method: 'Autopay' });
    fromBill(B.nfx, y, m, null, { method: 'Credit Card' });
    fromBill(B.spot, y, m, null, { method: 'E-Wallet' });
    fromBill(B.ins, y, m, null, { method: 'Autopay' });
    fromBill(B.loani, y, m, null, { method: 'Bank Transfer' });

    tx(d(5), 'transfer', 'Automatic savings transfer', 5000, '', BPI, SAV, { method: 'Bank Transfer' });
    tx(d(7), 'transfer', 'GCash cash-in', 4000, '', BPI, GC, { method: 'Bank Transfer' });
    tx(d(12), 'transfer', 'ATM withdrawal', 5000, '', BPI, CASH, { method: 'ATM' });

    for (var g = rnd(2, 5); g <= last; g += rnd(6, 9))
      tx(d(g), 'expense', pick(GROC), rnd(1300, 2600), 'Groceries', (g % 2 ? GC : BPI), '', { method: 'E-Wallet' });
    for (var f = 0, nf = rnd(8, 11); f < nf; f++)
      tx(d(rnd(1, last)), 'expense', pick(FOOD), rnd(140, 720), 'Food & Dining', (Math.random() < 0.5 ? CASH : GC), '');
    for (var j = 0, nj = rnd(1, 2); j < nj; j++) tx(d(rnd(3, last)), 'expense', 'Shell fuel', rnd(1150, 1850), 'Transportation', BPI, '');
    for (j = 0, nj = rnd(2, 4); j < nj; j++) tx(d(rnd(1, last)), 'expense', 'Grab ride', rnd(140, 420), 'Transportation', GC, '', { method: 'E-Wallet' });
    if (i >= 2) for (j = 0, nj = rnd(1, 3); j < nj; j++) tx(d(rnd(1, last)), 'expense', pick(['Shopee', 'Lazada', 'Uniqlo']), rnd(400, 2200), 'Shopping', GC, '');
    for (j = 0, nj = rnd(1, 2); j < nj; j++) tx(d(rnd(1, last)), 'expense', pick(['SM Cinemas', 'Bowling night', 'Board game cafe']), rnd(350, 900), 'Entertainment', CASH, '');
    tx(d(rnd(1, last)), 'expense', pick(['Barbershop', 'Watsons']), rnd(180, 650), 'Personal Care', CASH, '');
    for (j = 0, nj = rnd(2, 3); j < nj; j++)
      tx(d(rnd(1, last)), 'expense', pick(['Zalora order', 'AirAsia seat sale', 'Cafe Juanita dinner']), rnd(800, 5400), pick(['Shopping', 'Entertainment', 'Food & Dining']), CC, '', { method: 'Credit Card' });

    if (i === 1) tx(d(rnd(10, 25)), 'refund', 'Shopee refund (item returned)', rnd(400, 900), 'Shopping', '', GC, { method: 'E-Wallet' });
    if (i === 3) tx(d(rnd(8, 18)), 'expense', 'iPhone screen repair', 7800, 'Shopping', BPI, '', { notes: 'One-time repair' });
    if (i === 4) tx(d(rnd(6, 16)), 'expense', "St. Luke's ER visit", 9500, 'Healthcare', BPI, '', { notes: 'One-time' });

    if (cardOwed >= 1500 && 22 <= last) {
      var pay = Math.min(cardOwed, Math.max(2000, Math.round(cardOwed * 0.65 / 100) * 100), 7000);
      tx(d(22), 'cc_payment', 'Credit card payment - RCBC', pay, '', BPI, CC, { method: 'Bank Transfer' });
    }
  }
  Tx.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });

  /* next due date for each bill = first occurrence after today */
  var Bills = [];
  for (var key in B) {
    var b = B[key], due = ymd(TY, TM, b._day);
    if (due <= today) { var nx = addMonths(TY, TM, 1); due = ymd(nx[0], nx[1], b._day); }
    b.nextDue = due; delete b._day; Bills.push(b);
  }

  /* ---------- Budgets (last 3 months) ---------- */
  var BUD = { 'Needs': 25000, 'Wants': 18000, 'Food & Dining': 5000, 'Groceries': 10000, 'Housing & Rent': 13000, 'Utilities': 5500, 'Transportation': 4500,
              'Healthcare': 2000, 'Subscriptions': 2500, 'Shopping': 4000, 'Entertainment': 2500, 'Personal Care': 1000 };
  var Budgets = [];
  for (var k2 = -2; k2 <= 0; k2++) {
    var bm = addMonths(TY, TM, k2), month = bm[0] + '-' + pad(bm[1]);
    for (var c in BUD) Budgets.push({ id: id('BUD'), month: month, category: c, amount: BUD[c], scope: 'monthly',
                                      rollover: c === 'Groceries' || c === 'Food & Dining' });
  }

  /* ---------- Goals ---------- */
  var in12 = addMonths(TY, TM, 12), in8 = addMonths(TY, TM, 8);
  var Goals = [
    { id: id('GOL'), name: 'Emergency Fund', target: 120000, saved: 37000, targetDate: ymd(in12[0], in12[1], TD), monthlyContribution: 6000 },
    { id: id('GOL'), name: 'Travel', target: 80000, saved: 18000, targetDate: ymd(in8[0], in8[1], TD), monthlyContribution: 3000 },
    { id: id('GOL'), name: 'Investments', target: 100000, saved: 15000, targetDate: ymd(in12[0], in12[1], TD), monthlyContribution: 3000 }
  ];

  /* ---------- Plan (with Debts tab seated on Needs + Consumption Tanks + Savings subcategories) ---------- */
  var Plan = [
    { id: id('PLN'), group: 'Needs', name: 'Needs', pct: '', amount: 25000, worksOut: 25000, rollover: false, target: '', targetDate: '', paid: '', months: '', freq: '' },
    { id: id('PLN'), group: 'Debts', name: 'Personal / Credit Debt', pct: '', amount: 5000, worksOut: 5000, rollover: false, target: 30000, targetDate: '', paid: 0, months: 6, freq: 'Monthly' },
    { id: id('PLN'), group: 'Wants', name: 'Wants', pct: 30, amount: '', worksOut: 18000, rollover: false, target: '', targetDate: '', paid: '', months: '', freq: '' },
    { id: id('PLN'), group: 'Savings', name: 'Emergency Fund', pct: 10, amount: '', worksOut: 6000, rollover: false, target: 120000, targetDate: ymd(in12[0], in12[1], TD), paid: '', months: '', freq: '' },
    { id: id('PLN'), group: 'Savings', name: 'Travel', pct: 5, amount: '', worksOut: 3000, rollover: false, target: 80000, targetDate: ymd(in8[0], in8[1], TD), paid: '', months: '', freq: '' },
    { id: id('PLN'), group: 'Savings', name: 'Investments', pct: 5, amount: '', worksOut: 3000, rollover: false, target: 100000, targetDate: ymd(in12[0], in12[1], TD), paid: '', months: '', freq: '' }
  ];

  /* ---------- Categories & Settings ---------- */
  var EXP = [['Needs', true], ['Wants', false], ['Debt Payments', true], ['Food & Dining', false], ['Groceries', true], ['Housing & Rent', true], ['Utilities', true], ['Transportation', true],
             ['Healthcare', true], ['Subscriptions', false], ['Shopping', false], ['Entertainment', false], ['Debt Interest', true],
             ['Personal Care', false], ['Education', true], ['Reconciliation', true], ['Other', false]];
  var INC = ['Salary', 'Freelance', 'Business', 'Allowance', 'Investment Income', 'Other Income'];
  var ExpenseCategories = EXP.map(function (e) { return { id: id('EXP'), name: e[0], essential: e[1] }; });
  var IncomeCategories = INC.map(function (n) { return { id: id('INC'), name: n }; });
  var Settings = demoSettings_(true);

  // names are enough: the bridge fills every Category ID / Account ID from them
  return { ExpenseCategories: ExpenseCategories, IncomeCategories: IncomeCategories, Accounts: Accounts,
           Transactions: Tx, Budgets: Budgets, Bills: Bills, Goals: Goals, Plan: Plan, Settings: Settings };
}