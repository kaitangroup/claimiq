import type { Express } from "express";
import { Server } from "http";
import multer from "multer";
import * as XLSX from "xlsx";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import bcrypt from "bcryptjs";
import { storage, UPLOADS_DIR } from "./storage";
import { analyzeClaim, parsePaymentsFromRows } from "./analysis";
import { sendTrusteeConfirmation, sendAdminBidSummary } from "./email";
import {
  generateDemandLetter,
  generatePreferenceComplaint,
  generateFraudulentTransferComplaint,
  generatePostPetitionComplaint,
  type PartyInfo,
} from "./docgen";

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname);
      cb(null, `${uuidv4()}${ext}`);
    },
  }),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if ([".xlsx", ".xls", ".csv", ".pdf"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error("Only Excel, CSV, and PDF files are accepted"));
    }
  },
});

// ─── Auth middleware ──────────────────────────────────────────────────────────
function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.trusteeId) return res.status(401).json({ error: "Not authenticated" });
  next();
}

function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.trusteeId) return res.status(401).json({ error: "Not authenticated" });
  const trustee = storage.getTrusteeById(req.session.trusteeId);
  if (!trustee?.isAdmin) return res.status(403).json({ error: "Admin access required" });
  next();
}

// Strip passwordHash from trustee before sending to client
function safeTrustee(t: any) {
  if (!t) return null;
  const { passwordHash: _, ...safe } = t;
  return safe;
}

// Build analysis claim object from analyzeClaim result
function buildClaimData(
  caseId: number,
  defendantName: string,
  claimType: string,
  claimAmount: number,
  paymentTerms: string | null,
  pref: any[],
  hist: any[]
) {
  const analysis = analyzeClaim(pref, hist, claimAmount);
  return {
    caseId,
    defendantName: (defendantName || "Unknown").trim(),
    claimType,
    claimAmount,
    paymentTerms: paymentTerms || null,
    preferencePayments: JSON.stringify(pref),
    historicalPayments: JSON.stringify(hist),
    prefAvg: analysis.prefAvg,
    prefStdDev: analysis.prefStdDev,
    histAvg: analysis.histAvg,
    histStdDev: analysis.histStdDev,
    prefWeightedAvg: analysis.prefWeightedAvg,
    histWeightedAvg: analysis.histWeightedAvg,
    prefRangeMin: analysis.prefRange.min,
    prefRangeMax: analysis.prefRange.max,
    histRangeMin: analysis.histRange.min,
    histRangeMax: analysis.histRange.max,
    outlierCount: analysis.outlierCount,
    ordinaryScore: analysis.ordinaryScore,
    defenseStrength: analysis.defenseStrength,
    estimatedRecovery: analysis.estimatedRecovery,
    recommendedBid: analysis.recommendedBid,
    bidAsPercent: analysis.bidAsPercent,
    bidBasis: analysis.bidBasis,
    expectedHours: analysis.hours.expectedHours,
    expectedCost: analysis.hours.expectedCost,
    hourlyRate: analysis.hours.hourlyRate,
    hoursNarrative: analysis.hours.hoursNarrative,
    analystNotes: null,
    adminBidOverride: null,
    createdAt: new Date().toISOString(),
  };
}

export function registerRoutes(httpServer: Server, app: Express) {

  // ── Auth ──────────────────────────────────────────────────────────────────

  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, firstName, lastName, firm, phone, barNumber, district } = req.body;
      if (!email || !password || !firstName || !lastName)
        return res.status(400).json({ error: "Email, password, first name, and last name are required" });
      if (password.length < 8)
        return res.status(400).json({ error: "Password must be at least 8 characters" });

      const existing = storage.getTrusteeByEmail(email.toLowerCase().trim());
      if (existing) return res.status(409).json({ error: "An account with this email already exists" });

      const passwordHash = await bcrypt.hash(password, 12);
      const trustee = storage.createTrustee({
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        firm: firm?.trim() || null,
        phone: phone?.trim() || null,
        barNumber: barNumber?.trim() || null,
        district: district?.trim() || null,
        bio: null,
        isAdmin: false,
        createdAt: new Date().toISOString(),
      });

      (req as any).session.trusteeId = trustee.id;
      res.json(safeTrustee(trustee));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) return res.status(400).json({ error: "Email and password required" });

      const trustee = storage.getTrusteeByEmail(email.toLowerCase().trim());
      if (!trustee) return res.status(401).json({ error: "Invalid email or password" });

      const valid = await bcrypt.compare(password, trustee.passwordHash);
      if (!valid) return res.status(401).json({ error: "Invalid email or password" });

      (req as any).session.trusteeId = trustee.id;
      res.json(safeTrustee(trustee));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.post("/api/auth/logout", (req: any, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  app.get("/api/auth/me", (req: any, res) => {
    if (!req.session?.trusteeId) return res.json(null);
    const trustee = storage.getTrusteeById(req.session.trusteeId);
    res.json(safeTrustee(trustee));
  });

  app.patch("/api/auth/profile", requireAuth, async (req: any, res) => {
    try {
      const { firstName, lastName, firm, phone, barNumber, district, bio } = req.body;
      const updated = storage.updateTrustee(req.session.trusteeId, {
        firstName, lastName, firm, phone, barNumber, district, bio,
      });
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(safeTrustee(updated));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Cases (trustee-scoped) ─────────────────────────────────────────────────

  app.get("/api/cases", requireAuth, (req: any, res) => {
    res.json(storage.getCasesByTrustee(req.session.trusteeId));
  });

  app.post("/api/cases", requireAuth, (req: any, res) => {
    try {
      const { caseNumber, debtorName, chapter, filingDate, district, estimatedAssets, notes } = req.body;
      if (!caseNumber || !debtorName)
        return res.status(400).json({ error: "Case number and debtor name required" });

      const now = new Date().toISOString();
      const c = storage.createCase({
        trusteeId: req.session.trusteeId,
        caseNumber: caseNumber.trim(),
        debtorName: debtorName.trim(),
        chapter: chapter || "7",
        filingDate: filingDate || null,
        district: district?.trim() || null,
        estimatedAssets: estimatedAssets ? Number(estimatedAssets) : null,
        notes: notes?.trim() || null,
        status: "submitted",
        adminOffer: null,
        adminNotes: null,
        offerDate: null,
        acceptedDate: null,
        createdAt: now,
        updatedAt: now,
      });
      res.json(c);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/cases/:id", requireAuth, (req: any, res) => {
    const caseId = Number(req.params.id);
    const c = storage.getCaseById(caseId);
    // Admins can see all cases; trustees only see their own
    const trustee = storage.getTrusteeById(req.session.trusteeId);
    if (!c || (!trustee?.isAdmin && c.trusteeId !== req.session.trusteeId))
      return res.status(404).json({ error: "Not found" });

    const claimsData = storage.getClaimsByCase(c.id);
    const filesData = storage.getFilesByCase(c.id);
    const owner = storage.getTrusteeById(c.trusteeId);
    res.json({
      case: c,
      claims: claimsData,
      files: filesData,
      trustee: safeTrustee(owner),
    });
  });

  app.patch("/api/cases/:id", requireAuth, (req: any, res) => {
    try {
      const caseId = Number(req.params.id);
      const c = storage.getCaseById(caseId);
      if (!c || c.trusteeId !== req.session.trusteeId)
        return res.status(404).json({ error: "Not found" });

      const { notes, district, estimatedAssets } = req.body;
      const updated = storage.updateCase(caseId, {
        notes: notes !== undefined ? notes : c.notes,
        district: district !== undefined ? district : c.district,
        estimatedAssets: estimatedAssets !== undefined ? Number(estimatedAssets) : c.estimatedAssets,
      });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── File Upload ───────────────────────────────────────────────────────────

  app.post("/api/cases/:id/upload", requireAuth, upload.array("files", 20), async (req: any, res) => {
    try {
      const caseId = Number(req.params.id);
      const c = storage.getCaseById(caseId);
      if (!c || c.trusteeId !== req.session.trusteeId)
        return res.status(404).json({ error: "Not found" });

      const uploadedFiles = [];
      for (const file of (req.files as Express.Multer.File[])) {
        const ext = path.extname(file.originalname).toLowerCase();
        const fileType = [".xlsx", ".xls", ".csv"].includes(ext) ? "spreadsheet"
          : ext === ".pdf" ? "pdf" : "other";

        let parsedRows: number | null = null;
        let parseErrors: string | null = null;

        // Auto-parse XLSX/CSV and run analysis
        if (fileType === "spreadsheet") {
          try {
            const wb = XLSX.readFile(path.join(UPLOADS_DIR, file.filename));
            const ws = wb.Sheets[wb.SheetNames[0]];
            const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
            const { prefPayments, histPayments, errors } = parsePaymentsFromRows(rows);
            parsedRows = rows.length;
            parseErrors = errors.length ? JSON.stringify(errors) : null;

            if (prefPayments.length > 0 || histPayments.length > 0) {
              // Detect defendant name from sheet name or first row
              let defendantName = wb.SheetNames[0] !== "Sheet1"
                ? wb.SheetNames[0]
                : (rows[0]?.Defendant || rows[0]?.defendant || "Unknown Defendant");

              // Detect claim amount
              const claimAmountRow = rows.find((r: any) => {
                const v = String(r["Claim Amount"] || r["claim_amount"] || r["ClaimAmount"] || "");
                return parseFloat(v.replace(/[$,]/g, "")) > 0;
              });
              const claimAmount = claimAmountRow
                ? parseFloat(String(Object.values(claimAmountRow)[0]).replace(/[$,]/g, ""))
                : prefPayments.reduce((s, p) => s + p.amount, 0);

              const claimData = buildClaimData(
                caseId,
                String(defendantName),
                "preference",
                claimAmount,
                null,
                prefPayments,
                histPayments
              );
              storage.createClaim(claimData);
            }
          } catch (parseErr: any) {
            parseErrors = JSON.stringify([parseErr.message]);
          }
        }

        const saved = storage.createFile({
          caseId,
          trusteeId: req.session.trusteeId,
          originalName: file.originalname,
          storedName: file.filename,
          mimeType: file.mimetype,
          size: file.size,
          fileType,
          parsedRows,
          parseErrors,
          uploadedAt: new Date().toISOString(),
        });
        uploadedFiles.push(saved);
      }

      // Update case status
      storage.updateCase(caseId, { status: "under_review" });

      // Build email summary from live DB data
      const trustee = storage.getTrusteeById(req.session.trusteeId)!;
      const allClaims = storage.getClaimsByCase(caseId);
      const totalClaimAmount = allClaims.reduce((s, cl) => s + cl.claimAmount, 0);
      const totalRecommendedBid = allClaims.reduce((s, cl) =>
        s + (cl.adminBidOverride ?? cl.recommendedBid ?? 0), 0);
      const avgOrdinaryScore = allClaims.length
        ? allClaims.reduce((s, cl) => s + (cl.ordinaryScore ?? 50), 0) / allClaims.length
        : 0;
      const byStrength = {
        strong:   allClaims.filter(cl => cl.defenseStrength === "strong").length,
        moderate: allClaims.filter(cl => cl.defenseStrength === "moderate").length,
        weak:     allClaims.filter(cl => cl.defenseStrength === "weak").length,
      };

      sendTrusteeConfirmation({
        trusteeName: `${trustee.firstName} ${trustee.lastName}`,
        trusteeEmail: trustee.email,
        caseNumber: c.caseNumber,
        debtorName: c.debtorName,
        fileCount: uploadedFiles.length,
        caseId,
      }).catch(console.error);

      sendAdminBidSummary({
        trusteeName: `${trustee.firstName} ${trustee.lastName}`,
        trusteeEmail: trustee.email,
        trusteePhone: trustee.phone,
        caseNumber: c.caseNumber,
        debtorName: c.debtorName,
        caseId,
        claimCount: allClaims.length,
        totalClaimAmount,
        totalRecommendedBid,
        avgOrdinaryScore,
        byStrength,
        claimDetails: allClaims.map(cl => ({
          defendantName: cl.defendantName,
          claimType: cl.claimType,
          claimAmount: cl.claimAmount,
          ordinaryScore: cl.ordinaryScore,
          defenseStrength: cl.defenseStrength,
          estimatedRecovery: cl.estimatedRecovery,
          recommendedBid: cl.adminBidOverride ?? cl.recommendedBid,
          bidBasis: cl.bidBasis,
        })),
      }).catch(console.error);

      res.json({ uploaded: uploadedFiles, claimsAnalyzed: allClaims.length });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Serve uploaded files (trustee can only download their own; admin can download any)
  app.get("/api/files/:id/download", requireAuth, (req: any, res) => {
    const file = storage.getFileById(Number(req.params.id));
    if (!file) return res.status(404).json({ error: "Not found" });

    const trustee = storage.getTrusteeById(req.session.trusteeId);
    if (!trustee?.isAdmin && file.trusteeId !== req.session.trusteeId)
      return res.status(404).json({ error: "Not found" });

    const filePath = path.join(UPLOADS_DIR, file.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found on disk" });
    res.download(filePath, file.originalName);
  });

  // Delete a file
  app.delete("/api/files/:id", requireAuth, (req: any, res) => {
    const file = storage.getFileById(Number(req.params.id));
    if (!file || file.trusteeId !== req.session.trusteeId)
      return res.status(404).json({ error: "Not found" });
    const filePath = path.join(UPLOADS_DIR, file.storedName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    storage.deleteFile(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Claims ────────────────────────────────────────────────────────────────

  // Ad-hoc analysis (no save)
  app.post("/api/analyze", (req, res) => {
    try {
      const { prefPayments, histPayments, claimAmount } = req.body;
      const result = analyzeClaim(prefPayments || [], histPayments || [], Number(claimAmount) || 0);
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Create claim manually
  app.post("/api/cases/:id/claims", requireAuth, (req: any, res) => {
    try {
      const caseId = Number(req.params.id);
      const c = storage.getCaseById(caseId);
      if (!c || c.trusteeId !== req.session.trusteeId)
        return res.status(404).json({ error: "Not found" });

      const { defendantName, claimType, claimAmount, paymentTerms, preferencePayments, historicalPayments } = req.body;
      const pref = Array.isArray(preferencePayments) ? preferencePayments : JSON.parse(preferencePayments || "[]");
      const hist = Array.isArray(historicalPayments) ? historicalPayments : JSON.parse(historicalPayments || "[]");

      const claimData = buildClaimData(caseId, defendantName, claimType, Number(claimAmount), paymentTerms, pref, hist);
      const claim = storage.createClaim(claimData);
      const analysis = analyzeClaim(pref, hist, Number(claimAmount));
      res.json({ claim, analysis });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Update analyst notes on a claim (trustee or admin)
  app.patch("/api/claims/:id/notes", requireAuth, (req: any, res) => {
    try {
      const claimId = Number(req.params.id);
      const claim = storage.getClaimById(claimId);
      if (!claim) return res.status(404).json({ error: "Not found" });

      const c = storage.getCaseById(claim.caseId);
      const trustee = storage.getTrusteeById(req.session.trusteeId);
      if (!c || (!trustee?.isAdmin && c.trusteeId !== req.session.trusteeId))
        return res.status(404).json({ error: "Not found" });

      const updated = storage.updateClaim(claimId, { analystNotes: req.body.analystNotes || null });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Delete a claim
  app.delete("/api/claims/:id", requireAuth, (req: any, res) => {
    const claim = storage.getClaimById(Number(req.params.id));
    if (!claim) return res.status(404).json({ error: "Not found" });
    const c = storage.getCaseById(claim.caseId);
    const trustee = storage.getTrusteeById(req.session.trusteeId);
    if (!c || (!trustee?.isAdmin && c.trusteeId !== req.session.trusteeId))
      return res.status(404).json({ error: "Not found" });
    storage.deleteClaim(Number(req.params.id));
    res.json({ ok: true });
  });

  // ── Parse uploaded spreadsheet without saving ─────────────────────────────
  app.post("/api/parse-spreadsheet", requireAuth, upload.single("file"), (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file" });
      const wb = XLSX.readFile(path.join(UPLOADS_DIR, req.file.filename));
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "" });
      const { prefPayments, histPayments, errors } = parsePaymentsFromRows(rows);
      fs.unlinkSync(path.join(UPLOADS_DIR, req.file.filename));
      res.json({ rows: rows.length, prefPayments, histPayments, errors, preview: rows.slice(0, 8) });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Admin routes ─────────────────────────────────────────────────────────
  // All /api/admin/* require isAdmin = true

  // Dashboard stats
  app.get("/api/admin/stats", requireAdmin, (_req, res) => {
    const trusteeCount = storage.getTrusteeCount();
    const allCases = storage.getAllCases();
    const statusCounts = storage.getCaseCountByStatus();
    const claimStats = storage.getClaimStats();
    const fileCount = storage.getFileCount();
    const unreadInquiries = storage.getUnreadInquiryCount();

    res.json({
      trusteeCount,
      caseCount: allCases.length,
      statusCounts,
      claimStats,
      fileCount,
      unreadInquiries,
    });
  });

  // All cases with trustee info joined
  app.get("/api/admin/cases", requireAdmin, (_req, res) => {
    const allCases = storage.getAllCases();
    const result = allCases.map(c => {
      const trustee = storage.getTrusteeById(c.trusteeId);
      const claimsData = storage.getClaimsByCase(c.id);
      const totalFace = claimsData.reduce((s, cl) => s + cl.claimAmount, 0);
      const totalBid = claimsData.reduce((s, cl) => s + (cl.adminBidOverride ?? cl.recommendedBid ?? 0), 0);
      return { ...c, trustee: safeTrustee(trustee), claimCount: claimsData.length, totalFace, totalBid };
    });
    res.json(result);
  });

  // Update case status + offer amount (admin only)
  app.patch("/api/admin/cases/:id", requireAdmin, (req: any, res) => {
    try {
      const caseId = Number(req.params.id);
      const c = storage.getCaseById(caseId);
      if (!c) return res.status(404).json({ error: "Not found" });

      const { status, adminOffer, adminNotes, offerDate, acceptedDate } = req.body;
      const updated = storage.updateCase(caseId, {
        ...(status !== undefined && { status }),
        ...(adminOffer !== undefined && { adminOffer: Number(adminOffer) || null }),
        ...(adminNotes !== undefined && { adminNotes }),
        ...(offerDate !== undefined && { offerDate }),
        ...(acceptedDate !== undefined && { acceptedDate }),
      });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Override bid on a claim (admin only)
  app.patch("/api/admin/claims/:id", requireAdmin, (req: any, res) => {
    try {
      const claimId = Number(req.params.id);
      const claim = storage.getClaimById(claimId);
      if (!claim) return res.status(404).json({ error: "Not found" });

      const { adminBidOverride, analystNotes } = req.body;
      const updated = storage.updateClaim(claimId, {
        ...(adminBidOverride !== undefined && { adminBidOverride: Number(adminBidOverride) || null }),
        ...(analystNotes !== undefined && { analystNotes }),
      });
      res.json(updated);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // All trustees (admin only)
  app.get("/api/admin/trustees", requireAdmin, (_req, res) => {
    const trustees = storage.getAllTrustees().map(t => safeTrustee(t));
    res.json(trustees);
  });

  // All inquiries (admin only)
  app.get("/api/admin/inquiries", requireAdmin, (_req, res) => {
    res.json(storage.getAllInquiries());
  });

  // Mark inquiry read (admin only)
  app.patch("/api/admin/inquiries/:id/read", requireAdmin, (req, res) => {
    storage.markInquiryRead(Number(req.params.id));
    res.json({ ok: true });
  });

  // Promote/demote trustee to admin (admin only)
  app.patch("/api/admin/trustees/:id", requireAdmin, (req: any, res) => {
    try {
      const targetId = Number(req.params.id);
      const { isAdmin } = req.body;
      const updated = storage.updateTrustee(targetId, { isAdmin: Boolean(isAdmin) });
      res.json(safeTrustee(updated));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // ── Document Generation ───────────────────────────────────────────────────

  function buildPartyInfo(req: any): PartyInfo {
    const trustee = storage.getTrusteeById(req.session.trusteeId);
    if (!trustee) throw new Error("Not authenticated");
    return {
      trusteeName: req.body.trusteeName || `${trustee.firstName} ${trustee.lastName}`,
      debtorName: req.body.debtorName || "",
      debtorChapter: req.body.debtorChapter || "7",
      caseNumber: req.body.caseNumber || "",
      district: req.body.district || "Middle District of Florida, Tampa Division",
      judge: req.body.judge,
      adversaryNumber: req.body.adversaryNumber,
      defendantName: req.body.defendantName || "",
      defendantAddress: req.body.defendantAddress,
      defendantCounsel: req.body.defendantCounsel,
      filingDate: req.body.filingDate || "",
      prefPeriodStart: req.body.prefPeriodStart || "",
      lookbackPeriodStart: req.body.lookbackPeriodStart || "",
      claimAmount: Number(req.body.claimAmount) || 0,
      payments: Array.isArray(req.body.payments) ? req.body.payments : [],
      paymentTerms: req.body.paymentTerms,
      ordinaryScore: req.body.ordinaryScore ? Number(req.body.ordinaryScore) : undefined,
      defenseStrength: req.body.defenseStrength,
      bidBasis: req.body.bidBasis,
      plaintiffAttorney: req.body.plaintiffAttorney || `${trustee.firstName} ${trustee.lastName}`,
      plaintiffFirm: req.body.plaintiffFirm,
      plaintiffAddress: req.body.plaintiffAddress,
      plaintiffPhone: req.body.plaintiffPhone || trustee.phone || undefined,
      plaintiffEmail: req.body.plaintiffEmail || trustee.email,
      plaintiffBarNumber: req.body.plaintiffBarNumber || trustee.barNumber || undefined,
    };
  }

  const docHeaders = (filename: string, res: any) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  };

  app.post("/api/docgen/demand-letter", requireAuth, (req: any, res) => {
    try {
      const info = buildPartyInfo(req);
      docHeaders(`demand-letter-${info.caseNumber.replace(/[^\w-]/g, "-")}.txt`, res);
      res.send(generateDemandLetter(info));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/docgen/preference-complaint", requireAuth, (req: any, res) => {
    try {
      const info = buildPartyInfo(req);
      docHeaders(`preference-complaint-${info.caseNumber.replace(/[^\w-]/g, "-")}.txt`, res);
      res.send(generatePreferenceComplaint(info));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/docgen/fraudulent-transfer-complaint", requireAuth, (req: any, res) => {
    try {
      const info = buildPartyInfo(req) as any;
      info.transferDescription = req.body.transferDescription || "";
      info.transferDate = req.body.transferDate || "";
      info.valueReceived = req.body.valueReceived;
      info.fraudType = req.body.fraudType || "constructive";
      docHeaders(`548-complaint-${info.caseNumber.replace(/[^\w-]/g, "-")}.txt`, res);
      res.send(generateFraudulentTransferComplaint(info));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/docgen/post-petition-complaint", requireAuth, (req: any, res) => {
    try {
      const info = buildPartyInfo(req) as any;
      info.transferDate = req.body.transferDate || "";
      info.transferDescription = req.body.transferDescription || "";
      info.courtAuthorization = req.body.courtAuthorization || false;
      docHeaders(`549-complaint-${info.caseNumber.replace(/[^\w-]/g, "-")}.txt`, res);
      res.send(generatePostPetitionComplaint(info));
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.post("/api/docgen/preview", requireAuth, (req: any, res) => {
    try {
      const { docType, ...body } = req.body;
      req.body = body;
      const info = buildPartyInfo(req);
      let text: string;
      if (docType === "demand-letter") {
        text = generateDemandLetter(info);
      } else if (docType === "preference-complaint") {
        text = generatePreferenceComplaint(info);
      } else if (docType === "fraudulent-transfer") {
        const ext = info as any;
        ext.transferDescription = body.transferDescription || "";
        ext.transferDate = body.transferDate || "";
        ext.fraudType = body.fraudType || "constructive";
        text = generateFraudulentTransferComplaint(ext);
      } else if (docType === "post-petition") {
        const ext = info as any;
        ext.transferDate = body.transferDate || "";
        ext.transferDescription = body.transferDescription || "";
        text = generatePostPetitionComplaint(ext);
      } else {
        return res.status(400).json({ error: "Unknown docType" });
      }
      res.json({ text, docType, generatedAt: new Date().toISOString() });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Contact / Inquiry form (public) ──────────────────────────────────────

  app.post("/api/inquiries", async (req, res) => {
    try {
      const { name, email, phone, role, message } = req.body;
      if (!name || !email) return res.status(400).json({ error: "Name and email required" });
      const inquiry = storage.createInquiry({
        name, email, phone: phone || null, role: role || null,
        message: message || null, isRead: false,
        createdAt: new Date().toISOString(),
      });
      res.json(inquiry);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
