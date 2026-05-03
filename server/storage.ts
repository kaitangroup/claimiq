import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), "claimiq.db");
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

// Uploads directory
export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// ─── Bootstrap / migrate tables ──────────────────────────────────────────────
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS trustees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    firm TEXT,
    phone TEXT,
    bar_number TEXT,
    district TEXT,
    bio TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    trustee_id INTEGER NOT NULL,
    case_number TEXT NOT NULL,
    debtor_name TEXT NOT NULL,
    chapter TEXT NOT NULL DEFAULT '7',
    filing_date TEXT,
    district TEXT,
    estimated_assets REAL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'submitted',
    admin_offer REAL,
    admin_notes TEXT,
    offer_date TEXT,
    accepted_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS claims (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    defendant_name TEXT NOT NULL,
    claim_type TEXT NOT NULL,
    claim_amount REAL NOT NULL,
    payment_terms TEXT,
    preference_payments TEXT NOT NULL DEFAULT '[]',
    historical_payments TEXT NOT NULL DEFAULT '[]',
    pref_avg REAL,
    pref_std_dev REAL,
    hist_avg REAL,
    hist_std_dev REAL,
    pref_weighted_avg REAL,
    hist_weighted_avg REAL,
    pref_range_min REAL,
    pref_range_max REAL,
    hist_range_min REAL,
    hist_range_max REAL,
    outlier_count INTEGER,
    ordinary_score REAL,
    defense_strength TEXT,
    estimated_recovery REAL,
    recommended_bid REAL,
    bid_as_percent REAL,
    bid_basis TEXT,
    expected_hours REAL,
    expected_cost REAL,
    hourly_rate REAL,
    hours_narrative TEXT,
    analyst_notes TEXT,
    admin_bid_override REAL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    case_id INTEGER NOT NULL,
    trustee_id INTEGER NOT NULL,
    original_name TEXT NOT NULL,
    stored_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    file_type TEXT NOT NULL,
    parsed_rows INTEGER,
    parse_errors TEXT,
    uploaded_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS inquiries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    role TEXT,
    message TEXT,
    is_read INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
`);

// ─── Run additive column migrations (safe if column already exists) ───────────
const runMigration = (sql: string) => {
  try { sqlite.exec(sql); } catch (_) { /* column already exists */ }
};
runMigration("ALTER TABLE trustees ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
runMigration("ALTER TABLE cases ADD COLUMN admin_offer REAL");
runMigration("ALTER TABLE cases ADD COLUMN admin_notes TEXT");
runMigration("ALTER TABLE cases ADD COLUMN offer_date TEXT");
runMigration("ALTER TABLE cases ADD COLUMN accepted_date TEXT");
runMigration("ALTER TABLE claims ADD COLUMN pref_range_min REAL");
runMigration("ALTER TABLE claims ADD COLUMN pref_range_max REAL");
runMigration("ALTER TABLE claims ADD COLUMN hist_range_min REAL");
runMigration("ALTER TABLE claims ADD COLUMN hist_range_max REAL");
runMigration("ALTER TABLE claims ADD COLUMN outlier_count INTEGER");
runMigration("ALTER TABLE claims ADD COLUMN bid_as_percent REAL");
runMigration("ALTER TABLE claims ADD COLUMN expected_hours REAL");
runMigration("ALTER TABLE claims ADD COLUMN expected_cost REAL");
runMigration("ALTER TABLE claims ADD COLUMN hourly_rate REAL");
runMigration("ALTER TABLE claims ADD COLUMN hours_narrative TEXT");
runMigration("ALTER TABLE claims ADD COLUMN admin_bid_override REAL");
runMigration("ALTER TABLE files ADD COLUMN parsed_rows INTEGER");
runMigration("ALTER TABLE files ADD COLUMN parse_errors TEXT");
runMigration("ALTER TABLE inquiries ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0");

// ─── Storage interface ────────────────────────────────────────────────────────
export const storage = {

  // ── Trustees ────────────────────────────────────────────────────────────────
  createTrustee(data: Omit<schema.Trustee, "id">) {
    return db.insert(schema.trustees).values(data).returning().get()!;
  },
  getTrusteeById(id: number): schema.Trustee | undefined {
    return db.select().from(schema.trustees).where(eq(schema.trustees.id, id)).get();
  },
  getTrusteeByEmail(email: string): schema.Trustee | undefined {
    return db.select().from(schema.trustees).where(eq(schema.trustees.email, email)).get();
  },
  updateTrustee(id: number, data: Partial<Omit<schema.Trustee, "id" | "email" | "passwordHash" | "createdAt">>) {
    return db.update(schema.trustees).set(data).where(eq(schema.trustees.id, id)).returning().get();
  },
  getAllTrustees(): schema.Trustee[] {
    return db.select().from(schema.trustees).orderBy(desc(schema.trustees.createdAt)).all();
  },
  getTrusteeCount(): number {
    const row = db.select({ count: sql<number>`count(*)` }).from(schema.trustees).get();
    return row?.count ?? 0;
  },

  // ── Cases ───────────────────────────────────────────────────────────────────
  createCase(data: Omit<schema.Case, "id">) {
    return db.insert(schema.cases).values(data).returning().get()!;
  },
  getCaseById(id: number): schema.Case | undefined {
    return db.select().from(schema.cases).where(eq(schema.cases.id, id)).get();
  },
  getCasesByTrustee(trusteeId: number): schema.Case[] {
    return db.select().from(schema.cases)
      .where(eq(schema.cases.trusteeId, trusteeId))
      .orderBy(desc(schema.cases.createdAt))
      .all();
  },
  getAllCases(): schema.Case[] {
    return db.select().from(schema.cases).orderBy(desc(schema.cases.createdAt)).all();
  },
  updateCaseStatus(id: number, status: string) {
    return db.update(schema.cases)
      .set({ status, updatedAt: new Date().toISOString() })
      .where(eq(schema.cases.id, id)).returning().get();
  },
  updateCase(id: number, data: Partial<Omit<schema.Case, "id" | "createdAt">>) {
    return db.update(schema.cases)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(schema.cases.id, id)).returning().get();
  },
  deleteCase(id: number) {
    // Cascade: delete claims and files first
    const claimIds = db.select({ id: schema.claims.id })
      .from(schema.claims).where(eq(schema.claims.caseId, id)).all();
    for (const c of claimIds) db.delete(schema.claims).where(eq(schema.claims.id, c.id)).run();
    db.delete(schema.files).where(eq(schema.files.caseId, id)).run();
    db.delete(schema.cases).where(eq(schema.cases.id, id)).run();
  },
  getCaseCountByStatus(): Record<string, number> {
    const rows = db.select({
      status: schema.cases.status,
      count: sql<number>`count(*)`,
    }).from(schema.cases).groupBy(schema.cases.status).all();
    return Object.fromEntries(rows.map(r => [r.status, r.count]));
  },

  // ── Claims ──────────────────────────────────────────────────────────────────
  createClaim(data: Omit<schema.Claim, "id">) {
    return db.insert(schema.claims).values(data).returning().get()!;
  },
  getClaimById(id: number): schema.Claim | undefined {
    return db.select().from(schema.claims).where(eq(schema.claims.id, id)).get();
  },
  getClaimsByCase(caseId: number): schema.Claim[] {
    return db.select().from(schema.claims)
      .where(eq(schema.claims.caseId, caseId))
      .orderBy(schema.claims.id)
      .all();
  },
  getAllClaims(): schema.Claim[] {
    return db.select().from(schema.claims).orderBy(desc(schema.claims.createdAt)).all();
  },
  updateClaim(id: number, data: Partial<Omit<schema.Claim, "id" | "createdAt">>) {
    return db.update(schema.claims).set(data).where(eq(schema.claims.id, id)).returning().get();
  },
  deleteClaim(id: number) {
    db.delete(schema.claims).where(eq(schema.claims.id, id)).run();
  },
  getClaimStats(): { totalFace: number; totalBid: number; avgScore: number; count: number } {
    const row = db.select({
      totalFace: sql<number>`sum(claim_amount)`,
      totalBid: sql<number>`sum(coalesce(admin_bid_override, recommended_bid, 0))`,
      avgScore: sql<number>`avg(ordinary_score)`,
      count: sql<number>`count(*)`,
    }).from(schema.claims).get();
    return {
      totalFace: row?.totalFace ?? 0,
      totalBid: row?.totalBid ?? 0,
      avgScore: row?.avgScore ?? 0,
      count: row?.count ?? 0,
    };
  },

  // ── Files ───────────────────────────────────────────────────────────────────
  createFile(data: Omit<schema.UploadedFile, "id">) {
    return db.insert(schema.files).values(data).returning().get()!;
  },
  getFilesByCase(caseId: number): schema.UploadedFile[] {
    return db.select().from(schema.files)
      .where(eq(schema.files.caseId, caseId))
      .orderBy(desc(schema.files.uploadedAt))
      .all();
  },
  getFileById(id: number): schema.UploadedFile | undefined {
    return db.select().from(schema.files).where(eq(schema.files.id, id)).get();
  },
  deleteFile(id: number) {
    db.delete(schema.files).where(eq(schema.files.id, id)).run();
  },
  getFileCount(): number {
    const row = db.select({ count: sql<number>`count(*)` }).from(schema.files).get();
    return row?.count ?? 0;
  },

  // ── Inquiries ───────────────────────────────────────────────────────────────
  createInquiry(data: Omit<schema.Inquiry, "id">) {
    return db.insert(schema.inquiries).values(data).returning().get()!;
  },
  getAllInquiries(): schema.Inquiry[] {
    return db.select().from(schema.inquiries).orderBy(desc(schema.inquiries.createdAt)).all();
  },
  getInquiryById(id: number): schema.Inquiry | undefined {
    return db.select().from(schema.inquiries).where(eq(schema.inquiries.id, id)).get();
  },
  markInquiryRead(id: number) {
    db.update(schema.inquiries).set({ isRead: true }).where(eq(schema.inquiries.id, id)).run();
  },
  getUnreadInquiryCount(): number {
    const row = db.select({ count: sql<number>`count(*)` })
      .from(schema.inquiries).where(eq(schema.inquiries.isRead, false)).get();
    return row?.count ?? 0;
  },
};
