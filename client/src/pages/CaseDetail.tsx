import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useParams, useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Upload, FileText, BarChart3, DollarSign, AlertCircle,
  CheckCircle, Clock, ChevronLeft, Trash2, Download, TrendingUp,
  Timer, Edit2, X
} from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";
const pct = (n: number | null | undefined) =>
  n != null ? `${(n * 100).toFixed(1)}%` : "—";

const DEFENSE_CFG = {
  strong:   { label: "Strong Defense",   cls: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-800" },
  moderate: { label: "Moderate Defense", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800" },
  weak:     { label: "Weak Defense",     cls: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-800" },
} as const;

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  submitted:     { label: "Submitted",     color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",    icon: Clock },
  under_review:  { label: "Under Review",  color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200", icon: Clock },
  offer_pending: { label: "Offer Pending", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200", icon: AlertCircle },
  offer_made:    { label: "Offer Made",    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",  icon: CheckCircle },
  closed:        { label: "Closed",        color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",      icon: CheckCircle },
};

export default function CaseDetail() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [editingNotes, setEditingNotes] = useState<number | null>(null);
  const [notesValue, setNotesValue] = useState("");

  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/cases", id],
    queryFn: () => apiRequest("GET", `/api/cases/${id}`).then(r => r.json()),
  });

  const uploadFiles = useMutation({
    mutationFn: async (files: FileList) => {
      const fd = new FormData();
      Array.from(files).forEach(f => fd.append("files", f));
      // FormData uploads go through raw fetch — but must use API_BASE logic
      const API_BASE = (window as any).__API_BASE__ || ("__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__");
      const res = await fetch(`${API_BASE}/api/cases/${id}/upload`, {
        method: "POST", body: fd, credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Upload failed");
      return res.json();
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/cases", id] });
      toast({ title: "Files uploaded", description: `${data.uploaded?.length} file(s) received. Analysis running.` });
    },
    onError: (e: any) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const deleteFile = useMutation({
    mutationFn: (fileId: number) => apiRequest("DELETE", `/api/files/${fileId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cases", id] });
      toast({ title: "File deleted" });
    },
  });

  const deleteClaim = useMutation({
    mutationFn: (claimId: number) => apiRequest("DELETE", `/api/claims/${claimId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cases", id] });
      toast({ title: "Claim removed" });
    },
  });

  const saveNotes = useMutation({
    mutationFn: ({ claimId, notes }: { claimId: number; notes: string }) =>
      apiRequest("PATCH", `/api/claims/${claimId}/notes`, { analystNotes: notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/cases", id] });
      setEditingNotes(null);
      toast({ title: "Notes saved" });
    },
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground font-body">
      Loading case...
    </div>
  );
  if (!data || data.error) return (
    <div className="text-center py-20 text-muted-foreground font-body">Case not found.</div>
  );

  const { case: c, claims, files, trustee: owner } = data;
  const totalFace = claims.reduce((s: number, cl: any) => s + cl.claimAmount, 0);
  const effectiveBid = (cl: any) => cl.adminBidOverride ?? cl.recommendedBid;
  const totalBid  = claims.reduce((s: number, cl: any) => s + (effectiveBid(cl) ?? 0), 0);
  const avgScore  = claims.length
    ? claims.reduce((s: number, cl: any) => s + (cl.ordinaryScore ?? 50), 0) / claims.length
    : null;
  const statusCfg = STATUS_CFG[c.status] || STATUS_CFG.submitted;
  const StatusIcon = statusCfg.icon;

  const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <button onClick={() => navigate("/portal")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-body mb-6 transition-colors">
        <ChevronLeft size={14} /> Back to Portal
      </button>

      {/* Case header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 flex-wrap mb-1">
            <h1 className="font-display text-2xl font-semibold" data-testid="text-debtor-name">{c.debtorName}</h1>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1 ${statusCfg.color}`}>
              <StatusIcon size={10} /> {statusCfg.label}
            </span>
          </div>
          <div className="text-sm text-muted-foreground font-body flex gap-3 flex-wrap">
            <span className="font-mono" data-testid="text-case-number">{c.caseNumber}</span>
            <span>Ch. {c.chapter}</span>
            {c.district && <span>{c.district}</span>}
            {c.filingDate && <span>Filed {c.filingDate}</span>}
            <span className="text-[hsl(var(--gold))] font-medium">Ref: CIQ-{String(c.id).padStart(5,"0")}</span>
          </div>
          {owner && (
            <div className="text-xs text-muted-foreground font-body mt-1">
              Trustee: {owner.firstName} {owner.lastName}
              {owner.firm && ` · ${owner.firm}`}
              {owner.district && ` · ${owner.district}`}
            </div>
          )}
        </div>
        <label className="cursor-pointer">
          <input type="file" multiple accept=".xlsx,.xls,.csv,.pdf" className="hidden"
            data-testid="input-upload-files"
            onChange={e => e.target.files?.length && uploadFiles.mutate(e.target.files)} />
          <Button className="bg-navy hover:bg-navy-mid text-white font-body" asChild>
            <span>
              <Upload size={14} className="mr-2" />
              {uploadFiles.isPending ? "Uploading..." : "Upload More Files"}
            </span>
          </Button>
        </label>
      </div>

      {/* Admin offer banner */}
      {c.adminOffer && (
        <div className="mb-6 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={16} className="text-green-600" />
            <span className="font-body font-semibold text-sm">ClaimIQ has made an offer</span>
          </div>
          <div className="text-2xl font-display font-semibold text-green-700 dark:text-green-300">
            {fmt(c.adminOffer)}
          </div>
          {c.offerDate && (
            <div className="text-xs text-muted-foreground font-body mt-1">
              Offered {new Date(c.offerDate).toLocaleDateString()}
            </div>
          )}
          {c.adminNotes && (
            <p className="text-sm text-muted-foreground font-body mt-2 leading-relaxed">{c.adminNotes}</p>
          )}
        </div>
      )}

      {/* Summary stats */}
      {claims.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Claims Analyzed", value: claims.length.toString(), sub: "defendants", icon: BarChart3 },
            { label: "Total Face Value", value: fmt(totalFace), sub: "gross claim amount", icon: DollarSign },
            {
              label: c.adminOffer ? "Offer Made" : "Rec. Bid",
              value: c.adminOffer ? fmt(c.adminOffer) : fmt(totalBid),
              sub: totalFace > 0 ? `${(((c.adminOffer ?? totalBid) / totalFace) * 100).toFixed(1)}% of face` : "",
              icon: TrendingUp,
            },
            {
              label: "Avg Ordinary Score",
              value: avgScore != null ? `${avgScore.toFixed(0)}/100` : "—",
              sub: "higher = stronger defense",
              icon: CheckCircle,
            },
          ].map(({ label, value, sub, icon: Icon }) => (
            <Card key={label} data-testid={`card-stat-${label.replace(/\s+/g, "-").toLowerCase()}`}>
              <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body uppercase tracking-wide mb-1">
                  <Icon size={12} /> {label}
                </div>
                <div className="text-xl font-display font-semibold text-foreground">{value}</div>
                {sub && <div className="text-xs text-muted-foreground font-body mt-0.5">{sub}</div>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Claims analysis table */}
      {claims.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="font-display text-lg flex items-center gap-2">
              <BarChart3 size={18} className="text-[hsl(var(--gold))]" /> Claim-by-Claim Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm font-body border-collapse" data-testid="table-claims">
                <thead>
                  <tr className="border-b-2 border-border">
                    {["Defendant", "Type", "Face Amount", "Ord. Score", "Defense", "Est. Recovery", "Rec. Bid", "Hours", ""].map(h => (
                      <th key={h} className={`pb-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground ${h === "Defendant" || h === "Type" ? "text-left" : h === "" ? "" : "text-right"} ${h === "Defense" || h === "Ord. Score" ? "text-center" : ""}`}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {claims.map((cl: any) => {
                    const dcfg = DEFENSE_CFG[cl.defenseStrength as keyof typeof DEFENSE_CFG];
                    const bid = effectiveBid(cl);
                    const scoreColor = (cl.ordinaryScore ?? 50) >= 62 ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      : (cl.ordinaryScore ?? 50) >= 40 ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                      : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
                    return (
                      <tr key={cl.id} className="border-b border-border hover:bg-secondary/30 transition-colors"
                        data-testid={`row-claim-${cl.id}`}>
                        <td className="py-3 font-medium">{cl.defendantName}</td>
                        <td className="py-3 text-muted-foreground capitalize text-xs">{cl.claimType?.replace(/_/g," ")}</td>
                        <td className="py-3 text-right font-mono text-xs">{fmt(cl.claimAmount)}</td>
                        <td className="py-3 text-center">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${scoreColor}`}>
                            {cl.ordinaryScore?.toFixed(0) ?? "—"}
                          </span>
                        </td>
                        <td className="py-3 text-center">
                          {dcfg && (
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded ${dcfg.cls}`}>
                              {dcfg.label}
                            </span>
                          )}
                        </td>
                        <td className="py-3 text-right text-xs text-muted-foreground">{pct(cl.estimatedRecovery)}</td>
                        <td className="py-3 text-right font-semibold text-[hsl(var(--gold))]">
                          {fmt(bid)}
                          {cl.adminBidOverride != null && (
                            <div className="text-xs text-muted-foreground font-normal">(adjusted)</div>
                          )}
                        </td>
                        <td className="py-3 text-right text-xs text-muted-foreground">
                          {cl.expectedHours != null ? `${cl.expectedHours}h` : "—"}
                        </td>
                        <td className="py-3 text-right">
                          <button onClick={() => deleteClaim.mutate(cl.id)}
                            className="text-muted-foreground/40 hover:text-red-500 transition-colors p-1"
                            title="Remove claim" data-testid={`button-delete-claim-${cl.id}`}>
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/50 font-semibold">
                    <td colSpan={2} className="py-3 px-0">TOTAL</td>
                    <td className="py-3 text-right font-mono text-sm">{fmt(totalFace)}</td>
                    <td colSpan={3}></td>
                    <td className="py-3 text-right text-[hsl(var(--gold))] text-sm">{fmt(totalBid)}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Bid basis + hours narrative */}
            {claims.map((cl: any) => cl.bidBasis && (
              <div key={`basis-${cl.id}`} className="mt-4 p-3 bg-secondary/30 rounded-lg">
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 font-body">
                  Analysis: {cl.defendantName}
                </div>
                <p className="text-xs text-muted-foreground font-body leading-relaxed">{cl.bidBasis}</p>
                {cl.hoursNarrative && (
                  <p className="text-xs text-muted-foreground font-body leading-relaxed mt-1">
                    <span className="font-semibold">Hours model:</span> {cl.hoursNarrative}
                  </p>
                )}
                {/* Analyst notes */}
                {editingNotes === cl.id ? (
                  <div className="mt-2 flex gap-2">
                    <textarea rows={2} value={notesValue}
                      onChange={e => setNotesValue(e.target.value)}
                      className="flex-1 text-xs border border-border rounded p-2 bg-background font-body resize-none"
                      placeholder="Add notes..." />
                    <div className="flex flex-col gap-1">
                      <button onClick={() => saveNotes.mutate({ claimId: cl.id, notes: notesValue })}
                        className="text-xs bg-navy text-white px-2 py-1 rounded font-body">Save</button>
                      <button onClick={() => setEditingNotes(null)}
                        className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 font-body"><X size={12}/></button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-2 flex items-start gap-2">
                    <p className="text-xs text-muted-foreground font-body flex-1">
                      {cl.analystNotes || <span className="italic opacity-50">No analyst notes</span>}
                    </p>
                    <button onClick={() => { setEditingNotes(cl.id); setNotesValue(cl.analystNotes || ""); }}
                      className="text-muted-foreground/50 hover:text-foreground transition-colors p-0.5 flex-shrink-0">
                      <Edit2 size={11} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Files */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <FileText size={18} className="text-[hsl(var(--gold))]" /> Uploaded Files ({files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 border-2 border-dashed border-border rounded-lg">
              <Upload size={28} className="text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground font-body">No files uploaded yet.</p>
              <p className="text-xs text-muted-foreground font-body">Upload Excel spreadsheets or PDFs to begin due diligence.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((f: any) => (
                <div key={f.id} className="flex items-center justify-between py-2 px-3 bg-secondary/30 rounded-lg"
                  data-testid={`row-file-${f.id}`}>
                  <div className="flex items-center gap-3 min-w-0">
                    <FileText size={16} className={f.fileType === "pdf" ? "text-red-500" : "text-green-600 dark:text-green-400"} />
                    <div className="min-w-0">
                      <div className="text-sm font-body font-medium truncate">{f.originalName}</div>
                      <div className="text-xs text-muted-foreground font-body flex gap-2 flex-wrap">
                        <span>{(f.size / 1024).toFixed(0)} KB</span>
                        <span>·</span>
                        <span>{f.fileType}</span>
                        {f.parsedRows != null && <><span>·</span><span>{f.parsedRows} rows parsed</span></>}
                        <span>·</span>
                        <span>{new Date(f.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                    <a href={`${API_BASE}/api/files/${f.id}/download`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 font-body"
                      data-testid={`link-download-file-${f.id}`}>
                      <Download size={12} /> Download
                    </a>
                    <button onClick={() => deleteFile.mutate(f.id)}
                      className="text-muted-foreground/40 hover:text-red-500 transition-colors p-1"
                      data-testid={`button-delete-file-${f.id}`}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Case notes */}
      {c.notes && (
        <Card>
          <CardContent className="pt-5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 font-body">Case Notes</div>
            <p className="text-sm text-muted-foreground font-body leading-relaxed">{c.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
