'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const X = require('../data/tiers.js');

/* ---------- corpus invariants ---------- */

test('tiers: three descending caps, contiguous bands, RBI-sourced', () => {
  assert.equal(X.TIERS.length, 3);
  assert.deepEqual(X.TIERS.map(t => t.capPct), [85, 80, 75]);
  assert.equal(X.TIERS[0].maxLoanPaise, 25000000);   // ₹2.5 lakh
  assert.equal(X.TIERS[1].maxLoanPaise, 50000000);   // ₹5 lakh
  assert.equal(X.TIERS[2].maxLoanPaise, null);
  for (const t of X.TIERS) assert.equal(t.clause, 'Para 19');
  assert.match(X.SOURCE.url, /^https:\/\/www\.rbi\.org\.in\//);
  assert.equal(X.SOURCE.verified_on, '2026-07-23');
  assert.equal(X.REF_PPT, 916);
});

/* ---------- the tiered ceiling: all eight boundary/plateau fixtures ---------- */

test('maxLawfulLoan: tier and plateau fixtures to the rupee', () => {
  assert.equal(X.maxLawfulLoan(280000), 238000);  // 85% tier
  assert.equal(X.maxLawfulLoan(294000), 249900);  // just under the tier-1 edge
  assert.equal(X.maxLawfulLoan(300000), 250000);  // plateau 1: 0.85V>2.5L, 0.80V<2.5L
  assert.equal(X.maxLawfulLoan(312500), 250000);  // exact plateau-1 exit: 0.80*312500
  assert.equal(X.maxLawfulLoan(400000), 320000);  // 80% tier
  assert.equal(X.maxLawfulLoan(625000), 500000);  // exact tier-2 top: 0.80*625000
  assert.equal(X.maxLawfulLoan(640000), 500000);  // plateau 2: 0.80V>5L, 0.75V<5L
  assert.equal(X.maxLawfulLoan(800000), 600000);  // 75% tier
});

test('plateau zones detected exactly as the page copy states', () => {
  assert.equal(X.ceilingInfo(30000000).plateau, 1);                          // ₹3.0L value
  assert.equal(X.ceilingInfo(64000000).plateau, 2);                          // ₹6.4L value
  assert.equal(X.ceilingInfo(28000000).plateau, 0);
  // plateau entry values quoted on the page: 0.85V first exceeds ₹2.5L at V≈₹2,94,117.65
  assert.equal(X.maxLawfulLoan(294117.65), 250000);
  assert.equal(X.maxLawfulLoan(294117.64), 249999.99);
  // the ceiling starts rising again just past ₹3,12,500 and ₹6,66,666.67
  assert.equal(X.maxLawfulLoan(312501), 250000.8);
  assert.equal(X.maxLawfulLoan(666666.67), 500000);
  assert.equal(X.maxLawfulLoan(666668), 500001);
});

/* ---------- valuation (Para 17 proportionate arithmetic) ---------- */

test('collateralValue22K: 18K (750) 45.8 g at 22K rate ₹6000/g', () => {
  assert.equal(X.collateralValue22K(45.8, 750, 6000), 225000); // 45.8*6000*750/916
  assert.equal(X.collateralValue22K(10, 916, 7000), 70000);    // 22K passthrough
  assert.equal(X.collateralValue22K(0, 916, 7000), 0);
});

/* ---------- true cost: the numbers animated in the bullet-vs-EMI scene ---------- */

test('emi + bullet fixtures match the page copy (₹2,00,000 @ 12%)', () => {
  assert.equal(X.emi(200000, 12, 12), 17769.76);          // classic 8884.88/lakh
  const e = X.emiTotals(200000, 12, 12);
  assert.equal(e.total, 213237.12);
  assert.equal(e.interest, 13237.12);
  assert.equal(X.bulletRepayable(200000, 12, 12), 224000); // simple interest, 12m
  assert.equal(X.bulletRepayable(200000, 12, 6), 212000);  // simple interest, 6m
});

/* ---------- margin call (Para 20) ---------- */

test('marginCallDropPct: ₹2L loan on ₹2.8L gold breaches at a 15.97% fall', () => {
  assert.equal(X.marginCallDropPct(200000, 280000), 15.97);
  assert.equal(X.marginCallDropPct(238000, 280000), 0);    // at the cap: no headroom
  assert.equal(X.marginCallDropPct(0, 280000), 0);
});

/* ---------- property test: 10,000 seeded random values ---------- */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('property: ceiling is monotone, ≤85% of value, and lawful in its own tier', () => {
  const rnd = mulberry32(0xB1DC0DE);
  const values = [];
  for (let i = 0; i < 10000; i++) {
    values.push(Math.floor((10000 + rnd() * (2000000 - 10000)) * 100)); // paise
  }
  values.sort((a, b) => a - b);
  let prev = -1;
  for (const v of values) {
    const L = X.maxLawfulLoanPaise(v);
    assert.ok(L >= prev, 'non-decreasing');
    assert.ok(L <= Math.floor(v * 85 / 100), 'never above 85% of value');
    const cap = X.tierCapPctForLoan(L);
    assert.ok(L <= Math.floor(v * cap / 100), 'lawful under the cap of its own tier');
    prev = L;
  }
});
