import nodemailer from "nodemailer";

// Configure via environment variables.
// For production: set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
// Falls back to Ethereal (test capture) if not set.

let transporter: nodemailer.Transporter;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  } else {
    // Ethereal test account — emails captured at https://ethereal.email
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    console.log("📧 Email: using Ethereal test account —", testAccount.user);
  }
  return transporter;
}

const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "planet44555@gmail.com";
const FROM_ADDRESS = process.env.FROM_ADDRESS ?? '"ClaimIQ" <noreply@claimiq.com>';

// ─── Trustee confirmation email ───────────────────────────────────────────────
export async function sendTrusteeConfirmation(opts: {
  trusteeName: string;
  trusteeEmail: string;
  caseNumber: string;
  debtorName: string;
  fileCount: number;
  caseId: number;
}) {
  const t = await getTransporter();
  const { trusteeName, trusteeEmail, caseNumber, debtorName, fileCount, caseId } = opts;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; color: #1a2035; background: #f7f8fc; margin: 0; padding: 0; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
    .header { background: #162044; padding: 32px 40px 24px; }
    .header h1 { color: #c9a227; margin: 0; font-size: 22px; font-family: Georgia, serif; letter-spacing: 0.01em; }
    .header p { color: #8899bb; margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px 40px; }
    .body p { line-height: 1.7; margin: 0 0 16px; }
    .info-box { background: #f0f4ff; border-left: 4px solid #c9a227; border-radius: 4px; padding: 16px 20px; margin: 20px 0; }
    .info-box table { width: 100%; border-collapse: collapse; }
    .info-box td { padding: 4px 0; font-size: 14px; }
    .info-box td:first-child { color: #555; width: 140px; font-weight: 500; }
    .next-steps { background: #f7f8fc; border-radius: 6px; padding: 20px 24px; margin: 20px 0; }
    .next-steps h3 { margin: 0 0 12px; font-size: 15px; color: #162044; }
    .next-steps ol { margin: 0; padding-left: 20px; }
    .next-steps li { margin-bottom: 8px; font-size: 14px; line-height: 1.6; }
    .footer { background: #f0f4ff; padding: 20px 40px; font-size: 12px; color: #888; border-top: 1px solid #e5e8f0; }
    .footer a { color: #c9a227; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>ClaimIQ &mdash; Avoidance Action Finance</h1>
      <p>Submission Received</p>
    </div>
    <div class="body">
      <p>Dear ${trusteeName},</p>
      <p>Thank you for submitting your case portfolio through the ClaimIQ portal. We have received your materials and will begin our due diligence review promptly — at no charge to you or the estate.</p>

      <div class="info-box">
        <table>
          <tr><td>Case Number:</td><td><strong>${caseNumber}</strong></td></tr>
          <tr><td>Debtor:</td><td><strong>${debtorName}</strong></td></tr>
          <tr><td>Files Uploaded:</td><td><strong>${fileCount} document${fileCount !== 1 ? "s" : ""}</strong></td></tr>
          <tr><td>Reference ID:</td><td><strong>CIQ-${String(caseId).padStart(5, "0")}</strong></td></tr>
          <tr><td>Submitted:</td><td>${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</td></tr>
        </table>
      </div>

      <div class="next-steps">
        <h3>What Happens Next</h3>
        <ol>
          <li><strong>Due Diligence (2–5 business days):</strong> Our team will analyze each claim using standard deviation analysis, weighted payment timing comparisons, and ordinary course defense assessment.</li>
          <li><strong>Purchase Offer:</strong> You will receive a written purchase offer by email and through your portal. Offers are firm and require no further negotiation unless you wish to discuss terms.</li>
          <li><strong>No Obligation:</strong> There is no fee or obligation at any stage, regardless of whether a transaction proceeds.</li>
        </ol>
      </div>

      <p>If you have additional documents, you can log back into your portal at any time and upload them directly to this case. Please reference <strong>CIQ-${String(caseId).padStart(5, "0")}</strong> in any correspondence.</p>
      <p>Do not hesitate to reach out if you have any questions.</p>
      <p style="margin-top:24px;">Respectfully,<br><strong>ClaimIQ Team</strong><br><a href="mailto:${ADMIN_EMAIL}">${ADMIN_EMAIL}</a></p>
    </div>
    <div class="footer">
      ClaimIQ &bull; Avoidance Action Finance &bull; North Fort Myers, Florida<br>
      This message was sent because you submitted a case portfolio through the ClaimIQ trustee portal.
    </div>
  </div>
</body>
</html>`;

  const info = await t.sendMail({
    from: FROM_ADDRESS,
    to: trusteeEmail,
    subject: `[ClaimIQ] Portfolio Received — ${caseNumber} (${debtorName})`,
    html,
    text: `Dear ${trusteeName},\n\nYour submission for case ${caseNumber} (${debtorName}) has been received. Reference ID: CIQ-${String(caseId).padStart(5,"0")}. We will conduct due diligence and provide a purchase offer within 2–5 business days, at no cost to the estate.\n\nClaimIQ Team`,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("📧 Trustee confirmation preview:", nodemailer.getTestMessageUrl(info));
  }
  return info;
}

// ─── Admin bid summary email (to you) ────────────────────────────────────────
export async function sendAdminBidSummary(opts: {
  trusteeName: string;
  trusteeEmail: string;
  trusteePhone?: string | null;
  caseNumber: string;
  debtorName: string;
  caseId: number;
  claimCount: number;
  totalClaimAmount: number;
  totalRecommendedBid: number;
  avgOrdinaryScore: number;
  byStrength: { strong: number; moderate: number; weak: number };
  claimDetails: Array<{
    defendantName: string;
    claimType: string;
    claimAmount: number;
    ordinaryScore: number | null;
    defenseStrength: string | null;
    estimatedRecovery: number | null;
    recommendedBid: number | null;
    bidBasis: string | null;
  }>;
}) {
  const t = await getTransporter();
  const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
  const pct = (n: number) => (n * 100).toFixed(1) + "%";

  const claimRows = opts.claimDetails.map(c => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;">${c.defendantName}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-transform:capitalize;">${c.claimType.replace(/_/g," ")}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-align:right;">${fmt(c.claimAmount)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-align:center;">${c.ordinaryScore?.toFixed(0) ?? "—"}/100</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-align:center;font-weight:600;color:${c.defenseStrength==="strong"?"#b34700":c.defenseStrength==="moderate"?"#8a6900":"#1a6e33"};">${c.defenseStrength?.toUpperCase() ?? "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-align:right;">${c.estimatedRecovery ? pct(c.estimatedRecovery) : "—"}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e8f0;text-align:right;font-weight:600;color:#162044;">${c.recommendedBid ? fmt(c.recommendedBid) : "—"}</td>
    </tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #1a2035; background: #f7f8fc; margin:0; padding:0; }
    .wrapper { max-width:800px; margin:40px auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.08); }
    .header { background:#162044; padding:28px 40px; }
    .header h1 { color:#c9a227; margin:0; font-size:20px; }
    .header p { color:#8899bb; margin:6px 0 0; font-size:13px; }
    .body { padding:28px 40px; }
    .summary-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:20px 0; }
    .stat { background:#f0f4ff; border-radius:6px; padding:14px 16px; }
    .stat .label { font-size:11px; color:#667; text-transform:uppercase; letter-spacing:0.05em; }
    .stat .value { font-size:22px; font-weight:700; color:#162044; margin-top:4px; }
    .stat .sub { font-size:11px; color:#999; margin-top:2px; }
    .highlight-bid { background:#162044; color:#c9a227; }
    .highlight-bid .label { color:#8899bb; }
    .highlight-bid .value { color:#c9a227; }
    table { width:100%; border-collapse:collapse; font-size:13px; margin-top:16px; }
    th { background:#f0f4ff; padding:10px; text-align:left; font-size:11px; text-transform:uppercase; letter-spacing:0.05em; color:#555; }
    .trustee-box { background:#f7f8fc; border:1px solid #e0e4f0; border-radius:6px; padding:16px 20px; margin-bottom:20px; }
    .footer { background:#f0f4ff; padding:16px 40px; font-size:12px; color:#888; border-top:1px solid #e0e4f0; }
    .action-btn { display:inline-block; background:#c9a227; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; font-weight:600; margin-top:16px; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>ClaimIQ &mdash; New Portfolio for Review</h1>
      <p>Action Required: Review and approve or adjust the recommended bid below</p>
    </div>
    <div class="body">
      <div class="trustee-box">
        <strong>Trustee:</strong> ${opts.trusteeName} &nbsp;|&nbsp;
        <strong>Email:</strong> <a href="mailto:${opts.trusteeEmail}">${opts.trusteeEmail}</a>
        ${opts.trusteePhone ? `&nbsp;|&nbsp;<strong>Phone:</strong> ${opts.trusteePhone}` : ""}
        <br><br>
        <strong>Case:</strong> ${opts.caseNumber} &nbsp;|&nbsp;
        <strong>Debtor:</strong> ${opts.debtorName} &nbsp;|&nbsp;
        <strong>Reference:</strong> CIQ-${String(opts.caseId).padStart(5,"0")}
      </div>

      <div class="summary-grid">
        <div class="stat">
          <div class="label">Total Claims</div>
          <div class="value">${opts.claimCount}</div>
          <div class="sub">across all defendants</div>
        </div>
        <div class="stat">
          <div class="label">Total Claim Face Value</div>
          <div class="value">${fmt(opts.totalClaimAmount)}</div>
          <div class="sub">gross amount at issue</div>
        </div>
        <div class="stat highlight-bid">
          <div class="label">Recommended Bid</div>
          <div class="value">${fmt(opts.totalRecommendedBid)}</div>
          <div class="sub">${opts.totalClaimAmount > 0 ? ((opts.totalRecommendedBid/opts.totalClaimAmount)*100).toFixed(1) : 0}% of face value</div>
        </div>
        <div class="stat">
          <div class="label">Avg Ordinary Score</div>
          <div class="value">${opts.avgOrdinaryScore.toFixed(0)}<span style="font-size:14px;font-weight:400;">/100</span></div>
          <div class="sub">higher = stronger defense</div>
        </div>
        <div class="stat">
          <div class="label">Defense Breakdown</div>
          <div class="value" style="font-size:14px;line-height:1.8;">
            <span style="color:#1a6e33;">&#9632; ${opts.byStrength.weak} Weak</span><br>
            <span style="color:#8a6900;">&#9632; ${opts.byStrength.moderate} Moderate</span><br>
            <span style="color:#b34700;">&#9632; ${opts.byStrength.strong} Strong</span>
          </div>
        </div>
        <div class="stat">
          <div class="label">Est. Blended Recovery</div>
          <div class="value">${opts.totalClaimAmount > 0 ? ((opts.totalRecommendedBid / opts.totalClaimAmount / 0.625)*100).toFixed(0) : 0}%</div>
          <div class="sub">of face if fully collected</div>
        </div>
      </div>

      <h3 style="margin-top:28px;font-size:15px;color:#162044;">Claim-by-Claim Analysis</h3>
      <table>
        <thead>
          <tr>
            <th>Defendant</th><th>Type</th><th style="text-align:right;">Face Amount</th>
            <th style="text-align:center;">Ord. Score</th><th style="text-align:center;">Defense</th>
            <th style="text-align:right;">Est. Recovery</th><th style="text-align:right;">Rec. Bid</th>
          </tr>
        </thead>
        <tbody>${claimRows}</tbody>
        <tfoot>
          <tr style="background:#f0f4ff;font-weight:700;">
            <td colspan="2" style="padding:10px;">TOTAL</td>
            <td style="padding:10px;text-align:right;">${fmt(opts.totalClaimAmount)}</td>
            <td colspan="3"></td>
            <td style="padding:10px;text-align:right;color:#162044;">${fmt(opts.totalRecommendedBid)}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top:24px;font-size:13px;color:#555;">
        <strong>Note:</strong> The recommended bid is generated by the ClaimIQ statistical engine and reflects an objective assessment of ordinary course defenses, estimated net recovery, and litigation cost risk. You should review each claim's bid basis and adjust before communicating an offer to the trustee.
      </p>
    </div>
    <div class="footer">
      ClaimIQ &bull; Reference CIQ-${String(opts.caseId).padStart(5,"0")} &bull; Generated ${new Date().toLocaleString("en-US")}
    </div>
  </div>
</body>
</html>`;

  const info = await t.sendMail({
    from: FROM_ADDRESS,
    to: ADMIN_EMAIL,
    subject: `[ClaimIQ] NEW PORTFOLIO — ${opts.caseNumber} | ${opts.debtorName} | Bid: ${fmt(opts.totalRecommendedBid)}`,
    html,
    text: `New portfolio submitted.\nCase: ${opts.caseNumber} | Debtor: ${opts.debtorName}\nTrustee: ${opts.trusteeName} <${opts.trusteeEmail}>\nClaims: ${opts.claimCount} | Total Face: ${fmt(opts.totalClaimAmount)} | Recommended Bid: ${fmt(opts.totalRecommendedBid)}`,
  });

  if (process.env.NODE_ENV !== "production") {
    console.log("📧 Admin bid summary preview:", nodemailer.getTestMessageUrl(info));
  }
  return info;
}
