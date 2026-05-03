import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation, Link } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, FolderOpen, Plus, User, FileText, CheckCircle,
  Clock, AlertCircle, DollarSign, ChevronRight, LogOut, Download
} from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  submitted:     { label: "Submitted",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",    icon: Clock },
  under_review:  { label: "Under Review",  color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Clock },
  offer_pending: { label: "Offer Pending", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: AlertCircle },
  offer_made:    { label: "Offer Made",    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",  icon: CheckCircle },
  closed:        { label: "Closed",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",      icon: CheckCircle },
};

const fmt = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

export default function Portal() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: meRaw, isLoading: meLoading } = useQuery({ queryKey: ["/api/auth/me"], retry: false });
  const me = meRaw as any;
  const { data: casesRaw = [], isLoading: casesLoading } = useQuery({
    queryKey: ["/api/cases"],
    enabled: !!me,
  });
  const cases = casesRaw as any[];

  const [newCase, setNewCase] = useState({
    caseNumber: "", debtorName: "", chapter: "7",
    filingDate: "", district: "", estimatedAssets: "", notes: "",
  });
  const [showNewCase, setShowNewCase] = useState(false);
  const [uploadingCaseId, setUploadingCaseId] = useState<number | null>(null);
  const [profileEdit, setProfileEdit] = useState(false);
  const [profile, setProfile] = useState<any>(null);

  // Redirect if not logged in
  if (!meLoading && !me) {
    navigate("/auth");
    return null;
  }

  const logout = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout", {}),
    onSuccess: () => { qc.invalidateQueries(); navigate("/"); },
  });

  const createCase = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/cases", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cases"] });
      setShowNewCase(false);
      setNewCase({ caseNumber: "", debtorName: "", chapter: "7", filingDate: "", district: "", estimatedAssets: "", notes: "" });
      toast({ title: "Case created", description: "You can now upload files for due diligence." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const uploadFiles = useMutation({
    mutationFn: async ({ caseId, files }: { caseId: number; files: FileList }) => {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("files", f));
      const res = await fetch(`/api/cases/${caseId}/upload`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/cases"] });
      setUploadingCaseId(null);
      toast({
        title: "Files uploaded",
        description: `${data.uploaded?.length} file(s) received. Confirmation email sent. Analysis underway.`,
      });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const saveProfile = useMutation({
    mutationFn: (data: any) => apiRequest("PATCH", "/api/auth/profile", data),
    onSuccess: (updated) => {
      qc.setQueryData(["/api/auth/me"], updated);
      setProfileEdit(false);
      toast({ title: "Profile updated" });
    },
  });

  if (meLoading) return <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground font-body">Loading...</div>;

  const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">
            Welcome, {me.firstName} {me.lastName}
          </h1>
          <p className="text-muted-foreground text-sm font-body mt-1">
            {me.firm && <span>{me.firm} · </span>}
            {me.district && <span>{me.district} · </span>}
            {me.email}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => { setProfile({ ...(me as any) }); setProfileEdit(true); }}
            className="font-body"><User size={14} className="mr-1" /> Profile</Button>
          <Button variant="outline" size="sm" onClick={() => logout.mutate()} className="font-body">
            <LogOut size={14} className="mr-1" /> Sign Out
          </Button>
        </div>
      </div>

      <Tabs defaultValue="cases">
        <TabsList className="mb-6 font-body">
          <TabsTrigger value="cases"><FolderOpen size={14} className="mr-1.5" />My Cases</TabsTrigger>
          <TabsTrigger value="upload"><Upload size={14} className="mr-1.5" />Submit New Case</TabsTrigger>
          <TabsTrigger value="guide"><FileText size={14} className="mr-1.5" />Data Format Guide</TabsTrigger>
        </TabsList>

        {/* ── Cases tab ── */}
        <TabsContent value="cases">
          {casesLoading ? (
            <div className="text-center text-muted-foreground py-16 font-body">Loading cases...</div>
          ) : cases.length === 0 ? (
            <div className="text-center py-20 border-2 border-dashed border-border rounded-xl">
              <FolderOpen size={40} className="text-muted-foreground/40 mx-auto mb-3" />
              <h3 className="font-body font-semibold mb-1">No cases yet</h3>
              <p className="text-muted-foreground text-sm font-body mb-4">Submit your first avoidance action portfolio to get started.</p>
              <Button onClick={() => document.querySelector('[data-value="upload"]')?.dispatchEvent(new MouseEvent("click"))}
                className="bg-navy text-white font-body"><Plus size={14} className="mr-1" /> Submit Case</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {cases.map((c: any) => {
                const cfg = STATUS_CONFIG[c.status] || STATUS_CONFIG.submitted;
                const Icon = cfg.icon;
                return (
                  <Card key={c.id} className="hover:border-[hsl(var(--gold))/50] transition-colors cursor-pointer"
                    onClick={() => navigate(`/case/${c.id}`)}>
                    <CardContent className="py-4 px-5">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-body font-semibold text-sm">{c.debtorName}</span>
                            <span className="text-muted-foreground text-xs font-mono">{c.caseNumber}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
                              <Icon size={10} className="inline mr-1" />{cfg.label}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground font-body flex gap-3 flex-wrap">
                            <span>Ch. {c.chapter}</span>
                            {c.district && <span>{c.district}</span>}
                            {c.filingDate && <span>Filed {c.filingDate}</span>}
                            <span>Ref: CIQ-{String(c.id).padStart(5,"0")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Quick upload */}
                          <label className="cursor-pointer">
                            <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" className="hidden"
                              onChange={e => e.target.files?.length && uploadFiles.mutate({ caseId: c.id, files: e.target.files })} />
                            <Button size="sm" variant="outline" className="font-body text-xs" asChild>
                              <span><Upload size={12} className="mr-1" /> Upload Files</span>
                            </Button>
                          </label>
                          <ChevronRight size={16} className="text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Submit New Case tab ── */}
        <TabsContent value="upload">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="font-display text-xl">Submit a New Case Portfolio</CardTitle>
              <p className="text-sm text-muted-foreground font-body">
                Enter the bankruptcy case details and upload your payment history files.
                You will receive a confirmation email immediately and an offer within 2–5 business days.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Case Number *</label>
                  <input data-testid="input-caseNumber" value={newCase.caseNumber}
                    placeholder="e.g. 24-12345-BKC-SMG"
                    onChange={e => setNewCase(n => ({ ...n, caseNumber: e.target.value }))}
                    className={inputCls} required />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Chapter</label>
                  <select data-testid="select-chapter" value={newCase.chapter}
                    onChange={e => setNewCase(n => ({ ...n, chapter: e.target.value }))} className={inputCls}>
                    <option value="7">Chapter 7</option>
                    <option value="11">Chapter 11</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium font-body mb-1 block">Debtor Name *</label>
                <input data-testid="input-debtorName" value={newCase.debtorName}
                  onChange={e => setNewCase(n => ({ ...n, debtorName: e.target.value }))}
                  className={inputCls} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Filing Date</label>
                  <input type="date" value={newCase.filingDate}
                    onChange={e => setNewCase(n => ({ ...n, filingDate: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">District</label>
                  <input placeholder="e.g. M.D. Fla." value={newCase.district}
                    onChange={e => setNewCase(n => ({ ...n, district: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium font-body mb-1 block">Estimated Total Assets</label>
                <input type="number" placeholder="0" value={newCase.estimatedAssets}
                  onChange={e => setNewCase(n => ({ ...n, estimatedAssets: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="text-sm font-medium font-body mb-1 block">Notes (optional)</label>
                <textarea rows={3} value={newCase.notes}
                  onChange={e => setNewCase(n => ({ ...n, notes: e.target.value }))}
                  placeholder="Any context about the claims, defendants, or case history..."
                  className={`${inputCls} resize-none`} />
              </div>

              <Button data-testid="button-create-case" onClick={() => createCase.mutate(newCase)}
                disabled={!newCase.caseNumber || !newCase.debtorName || createCase.isPending}
                className="w-full bg-navy hover:bg-navy-mid text-white font-body">
                {createCase.isPending ? "Creating..." : "Create Case — Then Upload Files"}
              </Button>

              {createCase.isSuccess && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm">
                  <CheckCircle size={16} className="inline text-green-600 mr-2" />
                  <span className="font-body">Case created. Now go to <strong>My Cases</strong> and upload your payment files.</span>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Format Guide tab ── */}
        <TabsContent value="guide">
          <div className="max-w-3xl space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-display text-xl">Spreadsheet Format Guide</CardTitle>
                <p className="text-sm text-muted-foreground font-body">
                  For fastest analysis, use an Excel spreadsheet (.xlsx) or CSV with the following columns.
                  We also accept PDFs — but spreadsheets allow automated analysis and faster turnaround.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body border-collapse">
                    <thead>
                      <tr className="bg-navy text-white">
                        <th className="text-left px-4 py-2.5 rounded-tl font-semibold">Column Name</th>
                        <th className="text-left px-4 py-2.5 font-semibold">Required</th>
                        <th className="text-left px-4 py-2.5 rounded-tr font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ["Amount",    "Required", "Dollar amount of each payment received from the debtor. Format: $10,000.00 or 10000"],
                        ["DaysLate",  "Required", "Days after invoice due date that payment was received. Negative values = paid early. Example: 15 (paid 15 days late), -5 (paid 5 days early)"],
                        ["Period",    "Required", `"Preference" for payments within 90 days of filing. "Historical" for payments in the 2-year prior period.`],
                        ["Date",      "Recommended", "Date payment was received. Format: MM/DD/YYYY or YYYY-MM-DD"],
                        ["Defendant", "Recommended", "Name of the defendant (who received the payment). One sheet per defendant is also acceptable."],
                        ["ClaimAmount","Recommended","Total face value of the preference claim against this defendant"],
                        ["PaymentTerms","Optional", `Invoice payment terms, e.g. "Net 30", "Net 60"`],
                      ].map(([col, req, desc], i) => (
                        <tr key={col} className={i % 2 === 0 ? "bg-background" : "bg-secondary/30"}>
                          <td className="px-4 py-2.5 font-mono text-xs text-gold font-semibold">{col}</td>
                          <td className="px-4 py-2.5">
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${req === "Required" ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" : req === "Recommended" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-muted text-muted-foreground"}`}>
                              {req}
                            </span>
                          </td>
                          <td className="px-4 py-2.5 text-muted-foreground text-xs leading-relaxed">{desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="bg-gold-light border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                  <h4 className="font-body font-semibold text-sm mb-2">Example Row Structure</h4>
                  <div className="overflow-x-auto">
                    <table className="text-xs font-mono border-collapse w-full">
                      <thead><tr className="border-b border-amber-200 dark:border-amber-700">
                        {["Amount","DaysLate","Period","Date","Defendant"].map(h => (
                          <th key={h} className="text-left px-3 py-1.5 text-amber-900 dark:text-amber-300 font-bold">{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {[
                          ["$12,500", "22", "Historical", "01/15/2022", "ABC Supply Co."],
                          ["$11,800", "31", "Historical", "04/10/2022", "ABC Supply Co."],
                          ["$13,200", "18", "Historical", "07/22/2022", "ABC Supply Co."],
                          ["$15,500", "45", "Preference", "10/01/2023", "ABC Supply Co."],
                          ["$14,900", "52", "Preference", "11/15/2023", "ABC Supply Co."],
                        ].map((row, i) => (
                          <tr key={i} className="border-b border-amber-100 dark:border-amber-900">
                            {row.map((cell, j) => (
                              <td key={j} className="px-3 py-1.5 text-amber-800 dark:text-amber-200">{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-amber-800 dark:text-amber-300 mt-2 font-body">
                    In this example, ABC Supply Co. typically paid in 18–31 days. The two preference period payments at 45 and 52 days are outside their normal range — indicating a potentially strong plaintiff case.
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="font-body font-semibold text-sm">Tips for Faster Processing</h4>
                  {[
                    "One worksheet per defendant — or include a Defendant column if combining multiple defendants on one sheet.",
                    "The more historical payment rows you include (going back 2 years), the more accurate our ordinary course analysis will be.",
                    "If you only have check dates and invoice dates, we can calculate DaysLate for you — just upload what you have and note it in the case comments.",
                    "PDFs are accepted but require manual data entry on our end, which adds 1–2 days to the analysis timeline.",
                  ].map((tip, i) => (
                    <div key={i} className="flex gap-2 text-sm text-muted-foreground font-body">
                      <span className="text-gold font-bold flex-shrink-0">{i + 1}.</span>
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Profile Edit Modal */}
      {profileEdit && profile && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="font-display text-xl">Edit Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">First Name</label>
                  <input value={profile.firstName} onChange={e => setProfile((p:any) => ({...p, firstName: e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Last Name</label>
                  <input value={profile.lastName} onChange={e => setProfile((p:any) => ({...p, lastName: e.target.value}))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium font-body mb-1 block">Firm</label>
                <input value={profile.firm || ""} onChange={e => setProfile((p:any) => ({...p, firm: e.target.value}))} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Phone</label>
                  <input value={profile.phone || ""} onChange={e => setProfile((p:any) => ({...p, phone: e.target.value}))} className={inputCls} />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">District</label>
                  <input value={profile.district || ""} onChange={e => setProfile((p:any) => ({...p, district: e.target.value}))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button onClick={() => saveProfile.mutate(profile)} disabled={saveProfile.isPending}
                  className="flex-1 bg-navy text-white font-body">Save</Button>
                <Button variant="outline" onClick={() => setProfileEdit(false)} className="flex-1 font-body">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
