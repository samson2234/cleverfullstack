// FR: ROI calculator — correct, honest and safe across tiny and very large businesses
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const roi = createRequire(import.meta.url)('../roi.js');
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} !~ ${b}`);

test('established: customers, revenue, uplift, profit and payback follow the stated formulas', () => {
  // 2,000 visitors x 3% = 60 enquiries x 30% = 18 customers x $1,200 = $21,600/month
  const r = roi.calcGrow({ visitors: 2000, conv: 3, close: 30, value: 1200, margin: 35, uplift: 0.15, cost: 499 });
  near(r.customers, 18); near(r.revenue, 21600);
  near(r.extraRevenue, 21600 * 0.15);      // uplift is applied to the enquiry rate, so revenue grows by exactly that share
  near(r.extraProfit, 21600 * 0.15 * 0.35);
  near(r.paybackMonths, 499 / (21600 * 0.15 * 0.35));
  near(r.net12, r.extraProfit * 12 - 499);
  assert.ok(r.valid);
});

test('the improvement is the visitor\'s assumption: bigger assumption => bigger result, zero => zero (no hidden multiplier)', () => {
  const base = { visitors: 5000, conv: 2, close: 25, value: 400, margin: 30, cost: 999 };
  const none = roi.calcGrow({ ...base, uplift: 0 });
  const low = roi.calcGrow({ ...base, uplift: roi.UPLIFT.low });
  const high = roi.calcGrow({ ...base, uplift: roi.UPLIFT.high });
  assert.equal(none.extraRevenue, 0);
  assert.equal(none.paybackMonths, null, 'no gain => no payback, never a fake number');
  assert.ok(high.extraRevenue > low.extraRevenue && low.extraRevenue > 0);
});

test('online store: buying directly ignores the close rate', () => {
  const a = roi.calcGrow({ visitors: 8000, conv: 1.8, close: 5, direct: true, value: 85, margin: 30, uplift: 0.3, cost: 1749 });
  const b = roi.calcGrow({ visitors: 8000, conv: 1.8, close: 100, direct: false, value: 85, margin: 30, uplift: 0.3, cost: 1749 });
  near(a.revenue, b.revenue);
  near(a.revenue, 8000 * 0.018 * 85);
});

test('works at both ends: small local business and a large high-value B2B firm', () => {
  const tiny = roi.calcGrow({ visitors: 100, conv: 2, close: 50, value: 300, margin: 40, uplift: 0.15, cost: 499 });
  assert.ok(Number.isFinite(tiny.extraProfit) && tiny.extraProfit > 0);
  const big = roi.calcGrow({ visitors: 1_000_000, conv: 2, close: 20, value: 100_000, margin: 40, uplift: 0.3, cost: 3000 });
  assert.ok(Number.isFinite(big.extraProfit));
  near(big.revenue, 1_000_000 * 0.02 * 0.2 * 100_000);
  assert.ok(big.paybackMonths < 0.01, 'a large business pays the site back almost instantly');
});

test('just starting: no traffic needed; break-even customers and payback', () => {
  // value $800, margin 35% => $280 profit per customer; $499 cost => 2 customers to cover it
  const r = roi.calcStart({ value: 800, margin: 35, customers: 2, cost: 499 });
  near(r.extraRevenue, 1600); near(r.extraProfit, 560);
  assert.equal(r.breakEvenCustomers, 2);
  near(r.paybackMonths, 499 / 560);
  near(r.net12, 560 * 12 - 499);
  assert.ok(r.valid);
});

test('never returns NaN/Infinity for empty, negative, text or absurd input', () => {
  const junk = [{}, { visitors: -5, conv: -1, value: -9 }, { visitors: 'abc', conv: null, value: undefined }, { visitors: 1e30, conv: 1e30, value: 1e30, margin: 1e9 }];
  for (const j of junk) for (const fn of [roi.calcGrow, roi.calcStart]) {
    const r = fn({ ...j, uplift: 0.3, cost: 499, customers: 'x' });
    for (const [k, v] of Object.entries(r)) if (typeof v === 'number') assert.ok(Number.isFinite(v), `${fn.name}.${k} = ${v} for ${JSON.stringify(j)}`);
  }
  assert.equal(roi.calcGrow({}).valid, false);
  assert.equal(roi.calcStart({ value: 0, margin: 35, customers: 2, cost: 499 }).valid, false);
});

test('enquiry rate after improvement never exceeds 100%', () => {
  const r = roi.calcGrow({ visitors: 1000, conv: 90, close: 100, value: 10, margin: 50, uplift: 0.5, cost: 100 });
  assert.ok(r.newCustomers <= 1000 + 1e-9);
});

test('log sliders map positions to values and back (100 to 1,000,000 visitors)', () => {
  assert.equal(roi.posToValue(0, 100, 1e6), 100);
  assert.equal(roi.posToValue(1000, 100, 1e6), 1e6);
  for (const v of [100, 250, 1000, 3200, 45000, 1e6]) {
    const back = roi.posToValue(roi.valueToPos(v, 100, 1e6), 100, 1e6);
    assert.ok(Math.abs(back - v) / v < 0.03, `${v} -> ${back}`);
  }
  assert.equal(roi.valueToPos(5, 100, 1e6), 0, 'below range clamps');
  assert.equal(roi.valueToPos(1e9, 100, 1e6), 1000, 'above range clamps');
});

test('package prices convert to a tidy local figure; USD is exact', () => {
  assert.equal(roi.packageCost(499, 'USD'), 499, 'the real USD price is never rounded');
  assert.equal(roi.packageCost(1749, 'USD'), 1749);
  assert.equal(roi.packageCost(999, 'GBP') % 10, 0);
  assert.ok(roi.packageCost(1749, 'GBP') < 1749 && roi.packageCost(1749, 'CAD') > 1749);
});

test('money formats in the right currency and language; huge values compact', () => {
  assert.match(roi.money(4050, 'USD', 'en'), /\$4,050/);
  assert.match(roi.money(4050, 'GBP', 'en'), /£4,050/);
  assert.match(roi.money(4050, 'EUR', 'fr'), /4\s?050/);
  assert.match(roi.money(250_000_000, 'USD', 'en'), /M/);
});

test('payback wording is human and bilingual', () => {
  const en = roi.T.en, fr = roi.T.fr;
  assert.equal(roi.paybackText(null, en), en.none);
  assert.equal(roi.paybackText(0.1, en), en.under1w);
  assert.match(roi.paybackText(0.5, en), /weeks/);
  assert.equal(roi.paybackText(2, en), '2 months');
  assert.equal(roi.paybackText(2.4, en), '2.4 months');
  assert.equal(roi.paybackText(30, en), en.years);
  assert.match(roi.paybackText(0.5, fr), /semaines/);
});

test('every translation key exists in both languages', () => {
  assert.deepEqual(Object.keys(roi.T.en).sort(), Object.keys(roi.T.fr).sort());
  for (const k of Object.keys(roi.T.en)) assert.ok(roi.T.fr[k] !== undefined && roi.T.fr[k] !== '', 'missing fr: ' + k);
});

test('presets produce sensible, finite examples', () => {
  for (const [name, p] of Object.entries(roi.PRESETS)) {
    const r = roi.calcGrow({ ...p, uplift: roi.UPLIFT.low, cost: 499 });
    assert.ok(r.valid && r.extraProfit > 0 && Number.isFinite(r.paybackMonths), name);
  }
});
