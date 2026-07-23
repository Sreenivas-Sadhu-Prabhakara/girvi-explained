/* girvi-explained — corpus + mini engine.
   The tier constants and every number animated on the page come from the
   Reserve Bank of India (Lending Against Gold and Silver Collateral)
   Directions, 2025 (RBI/2025-26/47, issued 6 June 2025, updated
   29 September 2025), verified 2026-07-23 against the live RBI page.
   Money is INTEGER PAISE internally; rupee-facing wrappers exist for the
   documented fixtures and display only. This module mirrors the engine of
   the girvi app (https://sreenivas-sadhu-prabhakara.github.io/girvi/) so
   the explainer can never drift from the tool it explains. */

'use strict';

var GIRVI_X = (function () {

  const SOURCE = {
    name: 'Reserve Bank of India (Lending Against Gold and Silver Collateral) Directions, 2025 (RBI/2025-26/47, 6 June 2025, updated 29 September 2025)',
    url: 'https://www.rbi.org.in/Scripts/NotificationUser.aspx?Id=12859&Mode=0',
    verified_on: '2026-07-23',
    in_force: '2026-04-01'
  };

  /* Para 19 — tiered LTV caps for consumption loans, chosen by the TOTAL
     consumption loan amount per borrower. maxLoanPaise = band top (null = open). */
  const TIERS = [
    { capPct: 85, maxLoanPaise: 250000 * 100, band: '≤ ₹2.5 lakh', clause: 'Para 19' },
    { capPct: 80, maxLoanPaise: 500000 * 100, band: '> ₹2.5–5 lakh', clause: 'Para 19' },
    { capPct: 75, maxLoanPaise: null,         band: '> ₹5 lakh',        clause: 'Para 19' }
  ];

  const REF_PPT = 916; // the 22-carat (916) reference purity of the typed rate

  /* ---------- integer helpers ---------- */

  function roundDiv(n, d) { return Math.floor(n / d + 0.5); } // half up, n>=0
  function round2(x) { return Math.round(x * 100) / 100; }
  function toPaise(rupees) { return Math.round(rupees * 100); }

  /* ---------- valuation (Para 17 proportionate arithmetic) ---------- */

  function collateralValuePaise(netMg, ppt, rate22kPaisePerG) {
    if (netMg <= 0 || rate22kPaisePerG <= 0) return 0;
    return roundDiv(netMg * rate22kPaisePerG * ppt, REF_PPT * 1000);
  }

  function collateralValue22K(netG, ppt, rate22kRupeesPerG) {
    return collateralValuePaise(Math.round(netG * 1000), ppt, toPaise(rate22kRupeesPerG)) / 100;
  }

  /* ---------- the tiered ceiling (Para 19) ----------
     Circular boundary: the applicable cap depends on the loan, which depends
     on the cap. A loan L is lawful iff L <= V x capPct(tier of L itself).
     Maximum = best of the three tier candidates, each clipped to its band top. */

  function maxLawfulLoanPaise(valuePaise) {
    if (valuePaise <= 0) return 0;
    let best = 0;
    for (const t of TIERS) {
      let cand = Math.floor(valuePaise * t.capPct / 100);
      if (t.maxLoanPaise !== null && cand > t.maxLoanPaise) cand = t.maxLoanPaise;
      if (cand > best) best = cand;
    }
    return best;
  }

  function maxLawfulLoan(valueRupees) {
    return maxLawfulLoanPaise(toPaise(valueRupees)) / 100;
  }

  function tierCapPctForLoan(loanPaise) {
    for (const t of TIERS) {
      if (t.maxLoanPaise === null || loanPaise <= t.maxLoanPaise) return t.capPct;
    }
    return TIERS[TIERS.length - 1].capPct;
  }

  /* Plateau detection: plateau k means the ceiling is pinned at tier k's band
     top and more gold does not raise it until value crosses exitValuePaise. */
  function ceilingInfo(valuePaise) {
    const ceilingPaise = maxLawfulLoanPaise(valuePaise);
    const info = { ceilingPaise, capPctAtCeiling: tierCapPctForLoan(ceilingPaise), plateau: 0, exitValuePaise: null };
    for (let k = 0; k < TIERS.length - 1; k++) {
      const t = TIERS[k], next = TIERS[k + 1];
      if (ceilingPaise === t.maxLoanPaise &&
          Math.floor(valuePaise * t.capPct / 100) > t.maxLoanPaise) {
        info.plateau = k + 1;
        info.exitValuePaise = Math.ceil((t.maxLoanPaise + 1) * 100 / next.capPct);
      }
    }
    return info;
  }

  /* ---------- true cost: EMI vs bullet ---------- */

  function emi(principalRupees, annualPct, months) {
    if (months <= 0) return 0;
    if (annualPct === 0) return round2(principalRupees / months);
    const i = annualPct / 1200;
    const f = Math.pow(1 + i, months);
    return round2(principalRupees * i * f / (f - 1));
  }

  function emiTotals(principalRupees, annualPct, months) {
    const m = emi(principalRupees, annualPct, months);
    const total = round2(m * months);
    return { emi: m, total, interest: round2(total - principalRupees) };
  }

  /* Bullet: simple interest (a labelled assumption — lenders' rests vary).
     Para 6(v): bullet LTV is computed on the total repayable at maturity. */
  function bulletRepayable(principalRupees, annualPct, months) {
    const pPaise = toPaise(principalRupees);
    return (pPaise + roundDiv(pPaise * annualPct * months, 100 * 12)) / 100;
  }

  /* Para 20: the LTV cap must hold throughout the tenor. Price-fall % at
     which the loan breaches the cap that applies to the loan itself. */
  function marginCallDropPct(loanRupees, valueRupees) {
    const loanPaise = toPaise(loanRupees), valuePaise = toPaise(valueRupees);
    if (loanPaise <= 0 || valuePaise <= 0) return 0;
    const thresholdPaise = roundDiv(loanPaise * 100, tierCapPctForLoan(loanPaise));
    if (thresholdPaise >= valuePaise) return 0;
    return round2((valuePaise - thresholdPaise) * 100 / valuePaise);
  }

  return {
    SOURCE, TIERS, REF_PPT,
    collateralValuePaise, collateralValue22K,
    maxLawfulLoanPaise, maxLawfulLoan, tierCapPctForLoan, ceilingInfo,
    emi, emiTotals, bulletRepayable, marginCallDropPct
  };
})();

if (typeof module !== 'undefined') module.exports = GIRVI_X;
