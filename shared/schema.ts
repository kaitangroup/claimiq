import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Trustees ────────────────────────────────────────────────────────────────
export const trustees = sqliteTable("trustees", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  firm: text("firm"),
  phone: text("phone"),
  barNumber: text("bar_number"),
  district: text("district"),
  bio: text("bio"),
  isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertTrusteeSchema = createInsertSchema(trustees)
  .omit({ id: true, passwordHash: true, createdAt: true, isAdmin: true })
  .extend({
    password: z.string().min(8, "Password must be at least 8 characters"),
  });
export type InsertTrustee = z.infer<typeof insertTrusteeSchema>;
export type Trustee = typeof trustees.$inferSelect;

// ─── Cases ───────────────────────────────────────────────────────────────────
export const cases = sqliteTable("cases", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  trusteeId: integer("trustee_id").notNull(),
  caseNumber: text("case_number").notNull(),
  debtorName: text("debtor_name").notNull(),
  chapter: text("chapter").notNull().default("7"),
  filingDate: text("filing_date"),
  district: text("district"),
  estimatedAssets: real("estimated_assets"),
  notes: text("notes"),
  status: text("status").notNull().default("submitted"),
  // Admin bid tracking
  adminOffer: real("admin_offer"),          // $ offer made to trustee
  adminNotes: text("admin_notes"),           // internal admin notes
  offerDate: text("offer_date"),             // when offer was sent
  acceptedDate: text("accepted_date"),       // when trustee accepted
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true, createdAt: true, updatedAt: true,
  adminOffer: true, adminNotes: true, offerDate: true, acceptedDate: true,
});
export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

// ─── Claims ──────────────────────────────────────────────────────────────────
export const claims = sqliteTable("claims", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  defendantName: text("defendant_name").notNull(),
  claimType: text("claim_type").notNull(), // preference | fraudulent_conveyance | post_petition | breach_of_contract
  claimAmount: real("claim_amount").notNull(),
  paymentTerms: text("payment_terms"),
  // JSON arrays of {date, amount, daysLate}
  preferencePayments: text("preference_payments").notNull().default("[]"),
  historicalPayments: text("historical_payments").notNull().default("[]"),
  // Statistical analysis results
  prefAvg: real("pref_avg"),
  prefStdDev: real("pref_std_dev"),
  histAvg: real("hist_avg"),
  histStdDev: real("hist_std_dev"),
  prefWeightedAvg: real("pref_weighted_avg"),
  histWeightedAvg: real("hist_weighted_avg"),
  prefRangeMin: real("pref_range_min"),
  prefRangeMax: real("pref_range_max"),
  histRangeMin: real("hist_range_min"),
  histRangeMax: real("hist_range_max"),
  outlierCount: integer("outlier_count"),
  // Scoring
  ordinaryScore: real("ordinary_score"),
  defenseStrength: text("defense_strength"),    // strong | moderate | weak
  // Economics
  estimatedRecovery: real("estimated_recovery"),
  recommendedBid: real("recommended_bid"),
  bidAsPercent: real("bid_as_percent"),
  bidBasis: text("bid_basis"),
  // Hours model
  expectedHours: real("expected_hours"),
  expectedCost: real("expected_cost"),
  hourlyRate: real("hourly_rate"),
  hoursNarrative: text("hours_narrative"),
  // Admin
  analystNotes: text("analyst_notes"),
  adminBidOverride: real("admin_bid_override"),  // manually adjusted bid
  createdAt: text("created_at").notNull(),
});

export const insertClaimSchema = createInsertSchema(claims).omit({
  id: true, createdAt: true,
});
export type InsertClaim = z.infer<typeof insertClaimSchema>;
export type Claim = typeof claims.$inferSelect;

// ─── Uploaded Files ──────────────────────────────────────────────────────────
export const files = sqliteTable("files", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  caseId: integer("case_id").notNull(),
  trusteeId: integer("trustee_id").notNull(),
  originalName: text("original_name").notNull(),
  storedName: text("stored_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  fileType: text("file_type").notNull(),          // spreadsheet | pdf | other
  parsedRows: integer("parsed_rows"),             // how many data rows were extracted
  parseErrors: text("parse_errors"),              // JSON array of parse error strings
  uploadedAt: text("uploaded_at").notNull(),
});

export const insertFileSchema = createInsertSchema(files).omit({ id: true });
export type InsertFile = z.infer<typeof insertFileSchema>;
export type UploadedFile = typeof files.$inferSelect;

// ─── Inquiries (public contact form) ─────────────────────────────────────────
export const inquiries = sqliteTable("inquiries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  role: text("role"),
  message: text("message"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull(),
});

export const insertInquirySchema = createInsertSchema(inquiries).omit({
  id: true, createdAt: true, isRead: true,
});
export type InsertInquiry = z.infer<typeof insertInquirySchema>;
export type Inquiry = typeof inquiries.$inferSelect;
