// ─── Statistical Analysis + Hours/Cost Engine ────────────────────────────────
// Calculates ordinary course score, defense strength, estimated recovery,
// attorney hours burden (min/max), litigation cost, and recommended bid.

export interface Payment {
  date?: string;
  amount: number;
  daysLate: number; // days past invoice due date; negative = paid early
}

export interface HoursEstimate {
  // Phase breakdowns (hours)
  demandLetterMin: number; demandLetterMax: number;
  negotiationMin: number;  negotiationMax: number;
  complaintMin: number;    complaintMax: number;
  discoveryMin: number;    discoveryMax: number;
  motionsMin: number;      motionsMax: number;
  trialMin: number;        trialMax: number;
  // Totals
  totalMin: number;
  totalMax: number;
  totalMidpoint: number;
  // Cost at your billing rate
  hourlyRate: number;
  costMin: number;
  costMax: number;
  costMidpoint: number;
  // Expected outcome path
  settlementProbability: number; // % chance settles before complaint
  litigationProbability: number; // % chance goes to adversary proceeding
  trialProbability: number;      // % chance reaches trial
  expectedHours: number;         // probability-weighted hours
  expectedCost: number;          // probability-weighted cost
  hoursNarrative: string;
}

export interface AnalysisResult {
  // Statistical metrics
  prefAvg: number;
  prefStdDev: number;
  histAvg: number;
  histStdDev: number;
  prefWeightedAvg: number;
  histWeightedAvg: number;
  prefRange: { min: number; max: number };
  histRange: { min: number; max: number };
  outlierCount: number;
  // Scoring
  ordinaryScore: number;        // 0–100; higher = more ordinary = weaker plaintiff case
  defenseStrength: "strong" | "moderate" | "weak";
  // Economics
  estimatedRecovery: number;    // fraction of face amount we expect to net
  hours: HoursEstimate;
  grossExpected: number;        // face × estimatedRecovery
  netExpectedAfterCost: number; // grossExpected − expectedCost
  recommendedBid: number;       // what to pay the trustee
  bidAsPercent: number;         // recommendedBid / claimAmount
  bidBasis: string;
}

// ─── Hours model ─────────────────────────────────────────────────────────────
// Based on published data, ASK LLP/industry norms, and practitioner experience:
//
// Stage 1 — Demand letter + pre-suit negotiation:
//   Simple (strong defense, small claim):  2–6 hrs
//   Moderate:                              4–10 hrs
//   Complex (weak defense, large claim):   6–15 hrs
//
// Stage 2 — Complaint drafting + filing (if no settlement):
//   Simple:   3–6 hrs
//   Moderate: 5–10 hrs
//   Complex:  8–16 hrs
//
// Stage 3 — Discovery (Rule 26 disclosures, document production, depos):
//   Simple:   5–15 hrs
//   Moderate: 10–30 hrs
//   Complex:  20–60 hrs
//
// Stage 4 — Motions (MSJ, motion to dismiss, pretrial):
//   Simple:   3–8 hrs
//   Moderate: 8–20 hrs
//   Complex:  15–40 hrs
//
// Stage 5 — Trial (rare — 99%+ settle before):
//   Simple:   8–16 hrs
//   Moderate: 16–40 hrs
//   Complex:  30–80 hrs
//
// Settlement probabilities (industry-wide):
//   Before complaint:  ~55% (strong defense) / ~40% (moderate) / ~25% (weak)
//   After complaint, before trial: ~40% / ~50% / ~65%
//   Trial: ~5% / ~10% / ~10%

const HOURLY_RATE = 400; // your billing rate; adjust via env or UI

function hoursModel(
  defense: "strong" | "moderate" | "weak",
  claimAmount: number
): HoursEstimate {
  // Scale slightly with claim size — larger claims = more contested
  const sizeFactor = claimAmount > 100000 ? 1.4 : claimAmount > 50000 ? 1.15 : 1.0;

  const base = {
    strong:   { demand: [2, 6],  neg: [2, 5],  complaint: [3, 6],  disc: [5, 15],  motions: [3, 8],  trial: [8,  16] },
    moderate: { demand: [4, 10], neg: [3, 8],  complaint: [5, 10], disc: [10, 30], motions: [8, 20], trial: [16, 40] },
    weak:     { demand: [6, 15], neg: [4, 10], complaint: [8, 16], disc: [20, 60], motions: [15, 40], trial: [30, 80] },
  }[defense];

  const sf = (n: number) => Math.round(n * sizeFactor * 10) / 10;

  const [demandMin, demandMax]       = base.demand.map(sf);
  const [negotiationMin, negotiationMax] = base.neg.map(sf);
  const [complaintMin, complaintMax] = base.complaint.map(sf);
  const [discoveryMin, discoveryMax] = base.disc.map(sf);
  const [motionsMin, motionsMax]     = base.motions.map(sf);
  const [trialMin, trialMax]         = base.trial.map(sf);

  // Settlement probabilities
  const settlementProbability =
    defense === "strong" ? 0.60 : defense === "moderate" ? 0.42 : 0.28;
  const litigationProbability =
    defense === "strong" ? 0.35 : defense === "moderate" ? 0.48 : 0.62;
  const trialProbability = 1 - settlementProbability - litigationProbability;

  // Hours per path (midpoints)
  const preComplaintHours = (demandMin + demandMax) / 2 + (negotiationMin + negotiationMax) / 2;
  const postComplaintHours = preComplaintHours + (complaintMin + complaintMax) / 2 + (discoveryMin + discoveryMax) / 2 + (motionsMin + motionsMax) / 2;
  const trialHours = postComplaintHours + (trialMin + trialMax) / 2;

  // Probability-weighted expected hours
  const expectedHours = Math.round(
    settlementProbability * preComplaintHours +
    litigationProbability * postComplaintHours +
    trialProbability * trialHours
  );

  const totalMin = Math.round(demandMin + negotiationMin);
  const totalMax = Math.round(demandMax + negotiationMax + complaintMax + discoveryMax + motionsMax + trialMax);
  const totalMidpoint = Math.round(expectedHours);

  const rate = HOURLY_RATE;
  const costMin = Math.round(totalMin * rate);
  const costMax = Math.round(totalMax * rate);
  const costMidpoint = Math.round(expectedHours * rate);
  const expectedCost = costMidpoint;

  const hoursNarrative =
    `If settled by demand letter (${(settlementProbability * 100).toFixed(0)}% probability): ~${Math.round(preComplaintHours)} hrs ($${Math.round(preComplaintHours * rate).toLocaleString()}). ` +
    `If litigated through adversary proceeding (${(litigationProbability * 100).toFixed(0)}% probability): ~${Math.round(postComplaintHours)} hrs ($${Math.round(postComplaintHours * rate).toLocaleString()}). ` +
    `If tried to judgment (${(trialProbability * 100).toFixed(0)}% probability): ~${Math.round(trialHours)} hrs ($${Math.round(trialHours * rate).toLocaleString()}). ` +
    `Probability-weighted expected investment: ${expectedHours} hrs / $${expectedCost.toLocaleString()}.`;

  return {
    demandLetterMin: demandMin, demandLetterMax: demandMax,
    negotiationMin, negotiationMax,
    complaintMin, complaintMax,
    discoveryMin, discoveryMax,
    motionsMin, motionsMax,
    trialMin, trialMax,
    totalMin, totalMax, totalMidpoint,
    hourlyRate: rate,
    costMin, costMax, costMidpoint,
    settlementProbability, litigationProbability, trialProbability,
    expectedHours, expectedCost,
    hoursNarrative,
  };
}

// ─── Core helpers ─────────────────────────────────────────────────────────────
function mean(vals: number[]): number {
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}
function sampleStdDev(vals: number[]): number {
  if (vals.length < 2) return 0;
  const m = mean(vals);
  return Math.sqrt(vals.reduce((s, v) => s + (v - m) ** 2, 0) / (vals.length - 1));
}
function weightedMean(payments: Payment[]): number {
  const total = payments.reduce((s, p) => s + p.amount, 0);
  if (!total) return 0;
  return payments.reduce((s, p) => s + p.daysLate * p.amount, 0) / total;
}

// ─── Main analysis function ───────────────────────────────────────────────────
export function analyzeClaim(
  prefPayments: Payment[],
  histPayments: Payment[],
  claimAmount: number
): AnalysisResult {
  const prefDays = prefPayments.map((p) => p.daysLate);
  const histDays = histPayments.map((p) => p.daysLate);

  const prefAvg = mean(prefDays);
  const prefStdDev = sampleStdDev(prefDays);
  const histAvg = mean(histDays);
  const histStdDev = sampleStdDev(histDays);
  const prefWeightedAvg = weightedMean(prefPayments);
  const histWeightedAvg = weightedMean(histPayments);
  const prefRange = { min: prefDays.length ? Math.min(...prefDays) : 0, max: prefDays.length ? Math.max(...prefDays) : 0 };
  const histRange = { min: histDays.length ? Math.min(...histDays) : 0, max: histDays.length ? Math.max(...histDays) : 0 };

  // ── Ordinary Score (mirrors §547(c)(2) ordinary course defense) ───────────
  let score = 50;

  // 1. Simple mean timing difference
  const daysDiff = Math.abs(prefAvg - histAvg);
  if      (daysDiff <= 5)  score += 22;
  else if (daysDiff <= 10) score += 14;
  else if (daysDiff <= 20) score += 4;
  else if (daysDiff <= 30) score -= 8;
  else                     score -= 18;

  // 2. Dollar-weighted mean timing difference
  const wDiff = Math.abs(prefWeightedAvg - histWeightedAvg);
  if      (wDiff <= 5)  score += 10;
  else if (wDiff <= 15) score += 5;
  else if (wDiff <= 30) score -= 3;
  else                  score -= 8;

  // 3. % of pref payments within historical 2σ band
  const lo = histAvg - 2 * histStdDev;
  const hi = histAvg + 2 * histStdDev;
  const outlierCount = prefDays.filter((d) => d < lo || d > hi).length;
  const pctInBand = prefDays.length > 0 ? (prefDays.length - outlierCount) / prefDays.length : 0;
  score += Math.round((pctInBand - 0.5) * 24);

  // 4. Spread consistency (pref σ vs hist σ)
  if (histStdDev > 0) {
    const relSpread = prefStdDev / histStdDev;
    if      (relSpread <= 1.1) score += 8;
    else if (relSpread <= 1.5) score += 2;
    else if (relSpread <= 2.0) score -= 4;
    else                       score -= 10;
  }

  // 5. Sample size penalty
  if (prefDays.length < 2) score -= 10;
  if (histDays.length < 4) score -= 6;

  const ordinaryScore = Math.max(0, Math.min(100, Math.round(score)));

  const defenseStrength: "strong" | "moderate" | "weak" =
    ordinaryScore >= 62 ? "strong" : ordinaryScore >= 40 ? "moderate" : "weak";

  // ── Hours & Cost ──────────────────────────────────────────────────────────
  const hours = hoursModel(defenseStrength, claimAmount);

  // ── Estimated Recovery ────────────────────────────────────────────────────
  const baseRecovery =
    defenseStrength === "strong"   ? 0.18 :
    defenseStrength === "moderate" ? 0.42 : 0.67;
  const jitter = ((ordinaryScore % 10) - 5) * 0.006;
  const estimatedRecovery = Math.max(0.05, Math.min(0.92, baseRecovery + jitter));

  // ── Bid Calculation ───────────────────────────────────────────────────────
  // Gross expected = face × estimated recovery
  // Net expected   = gross − probability-weighted attorney cost
  // Bid            = net × margin factor (our profit target)
  // We target ~35% return on our bid price.

  const grossExpected = claimAmount * estimatedRecovery;
  const netExpectedAfterCost = Math.max(0, grossExpected - hours.expectedCost);
  const marginFactor = 0.65; // we bid 65% of net (keeping 35% as our return)
  const recommendedBid = Math.max(0, netExpectedAfterCost * marginFactor);
  const bidAsPercent = claimAmount > 0 ? (recommendedBid / claimAmount) * 100 : 0;

  const bidBasis =
    `Ordinary Course Score: ${ordinaryScore}/100 — ${defenseStrength.toUpperCase()} defense. ` +
    `Pref avg: ${prefAvg >= 0 ? "+" : ""}${prefAvg.toFixed(1)} days | Hist avg: ${histAvg >= 0 ? "+" : ""}${histAvg.toFixed(1)} days (Δ ${Math.abs(prefAvg - histAvg).toFixed(1)} days, σ=${histStdDev.toFixed(1)}). ` +
    `Dollar-weighted: pref ${prefWeightedAvg >= 0 ? "+" : ""}${prefWeightedAvg.toFixed(1)} vs hist ${histWeightedAvg >= 0 ? "+" : ""}${histWeightedAvg.toFixed(1)} days. ` +
    `${outlierCount}/${prefDays.length} pref payments outside 2σ historical band. ` +
    `Est. gross recovery: ${(estimatedRecovery * 100).toFixed(0)}% = $${grossExpected.toFixed(0)}. ` +
    `Expected legal cost (prob-weighted): $${hours.expectedCost.toLocaleString()} (${hours.expectedHours} hrs × $${hours.hourlyRate}/hr). ` +
    `Net after cost: $${netExpectedAfterCost.toFixed(0)}. ` +
    `Bid at ${(marginFactor * 100).toFixed(0)}% of net (35% return target): $${recommendedBid.toFixed(0)} (${bidAsPercent.toFixed(1)}% of face).`;

  return {
    prefAvg, prefStdDev, histAvg, histStdDev,
    prefWeightedAvg, histWeightedAvg,
    prefRange, histRange, outlierCount,
    ordinaryScore, defenseStrength,
    estimatedRecovery, hours,
    grossExpected, netExpectedAfterCost,
    recommendedBid, bidAsPercent,
    bidBasis,
  };
}

// ─── Parse XLSX/CSV rows into payment arrays ──────────────────────────────────
export function parsePaymentsFromRows(rows: Record<string, any>[]): {
  prefPayments: Payment[];
  histPayments: Payment[];
  errors: string[];
} {
  const prefPayments: Payment[] = [];
  const histPayments: Payment[] = [];
  const errors: string[] = [];
  const norm = (v: string) => v.toString().toLowerCase().replace(/[\s_\-()]/g, "");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const keys = Object.keys(row);

    const amtKey  = keys.find((k) => ["amount","payment","paid","transfer","value"].some((t) => norm(k).includes(t)));
    const daysKey = keys.find((k) => ["dayslate","daysoverdue","dayspastdue","daystopay","timing","dayspaid","lateness"].some((t) => norm(k).includes(t)));
    const periodKey = keys.find((k) => ["period","window","type","category"].some((t) => norm(k).includes(t)));
    const dateKey = keys.find((k) => norm(k).includes("date"));

    if (!amtKey) { errors.push(`Row ${i + 2}: No amount column detected`); continue; }

    const rawAmt = String(row[amtKey] ?? "").replace(/[$,\s]/g, "");
    const amount = parseFloat(rawAmt);
    if (isNaN(amount) || amount <= 0) continue;

    const rawDays = daysKey ? String(row[daysKey] ?? "").replace(/[^\d.\-]/g, "") : "0";
    const daysLate = parseFloat(rawDays) || 0;
    const date = dateKey ? String(row[dateKey]) : undefined;
    const periodRaw = periodKey ? norm(String(row[periodKey])) : "";

    const isPref = periodRaw.includes("pref") || periodRaw.includes("90") || periodRaw === "p";
    const isHist = periodRaw.includes("hist") || periodRaw.includes("prior") || periodRaw.includes("2year") || periodRaw === "h";

    const payment: Payment = { amount, daysLate, date };

    if (isPref)       prefPayments.push(payment);
    else if (isHist)  histPayments.push(payment);
    else              errors.push(`Row ${i + 2}: Could not determine period (use "Preference" or "Historical" in Period column)`);
  }

  return { prefPayments, histPayments, errors };
}
