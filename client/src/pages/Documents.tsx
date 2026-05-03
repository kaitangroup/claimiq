import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileText, Download, ChevronLeft } from "lucide-react";

const DOC_TYPES = [
  {
    id: "demand-letter",
    title: "§ 547 Demand Letter",
    description: "Pre-suit demand letter to defendant's counsel seeking return of preferential transfers. 21-day response deadline.",
    endpoint: "/api/docgen/demand-letter",
    filename: "demand-letter.txt",
    extraFields: [],
  },
  {
    id: "preference-complaint",
    title: "§ 547 Preference Complaint",
    description: "Adversary proceeding complaint to avoid and recover preferential transfers. Includes all required elements under 11 U.S.C. §§ 547(b) and 550(a).",
    endpoint: "/api/docgen/preference-complaint",
    filename: "preference-complaint.txt",
    extraFields: [
      { key: "adversaryNumber", label: "Adversary Proc. No. (if assigned)", optional: true },
    ],
  },
  {
    id: "fraudulent-transfer",
    title: "§ 548 Fraudulent Transfer Complaint",
    description: "Adversary complaint for actual or constructive fraudulent transfer. Covers §548(a)(1)(A) and (B).",
    endpoint: "/api/docgen/fraudulent-transfer-complaint",
    filename: "548-complaint.txt",
    extraFields: [
      { key: "transferDate", label: "Transfer Date" },
      { key: "transferDescription", label: "Description of Transfer" },
      { key: "valueReceived", label: "Value Received by Debtor (if any)", optional: true },
      { key: "fraudType", label: "Fraud Type", type: "select", options: [
        { value: "constructive", label: "Constructive Fraud (§548(a)(1)(B))" },
        { value: "actual", label: "Actual Intent (§548(a)(1)(A))" },
      ]},
    ],
  },
  {
    id: "post-petition",
    title: "§ 549 Post-Petition Transfer Complaint",
    description: "Adversary complaint to avoid and recover unauthorized transfers of estate property occurring after the petition date.",
    endpoint: "/api/docgen/post-petition-complaint",
    filename: "549-complaint.txt",
    extraFields: [
      { key: "transferDate", label: "Date of Post-Petition Transfer" },
      { key: "transferDescription", label: "Description of Transfer" },
    ],
  },
];

const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body";

export default function Documents() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { data: meRaw } = useQuery({ queryKey: ["/api/auth/me"], retry: false });
  const me = meRaw as any;

  const [selectedDoc, setSelectedDoc] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const [form, setForm] = useState<any>({
    debtorName: "",
    debtorChapter: "7",
    caseNumber: "",
    district: "Middle District of Florida, Tampa Division",
    judge: "",
    adversaryNumber: "",
    defendantName: "",
    defendantAddress: "",
    defendantCounsel: "",
    filingDate: "",
    prefPeriodStart: "",
    lookbackPeriodStart: "",
    claimAmount: "",
    paymentTerms: "",
    plaintiffAttorney: me?.firstName ? `${me.firstName} ${me.lastName}` : "",
    plaintiffFirm: "",
    plaintiffAddress: "North Fort Myers, Florida",
    plaintiffPhone: me?.phone || "",
    plaintiffEmail: me?.email || "",
    plaintiffBarNumber: me?.barNumber || "",
    // Payments: manual entry as JSON text for now
    paymentsJson: `[
  {"date": "October 1, 2023", "amount": 15000, "description": "Invoice #1001"},
  {"date": "November 15, 2023", "amount": 14500, "description": "Invoice #1002"}
]`,
    // Extra fields for §548/§549
    transferDate: "",
    transferDescription: "",
    valueReceived: "",
    fraudType: "constructive",
  });

  const doc = DOC_TYPES.find(d => d.id === selectedDoc);

  const setF = (k: string, v: string) => setForm((f: any) => ({ ...f, [k]: v }));

  const buildPayload = () => {
    let payments: any[] = [];
    try { payments = JSON.parse(form.paymentsJson || "[]"); } catch { payments = []; }
    return {
      ...form,
      claimAmount: parseFloat(form.claimAmount) || 0,
      payments,
      docType: selectedDoc,
    };
  };

  const handleGenerate = async (download: boolean) => {
    if (!doc) return;
    setGenerating(true);
    try {
      const payload = buildPayload();
      if (download) {
        const res = await fetch(doc.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || "Generation failed");
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedDoc}-${form.caseNumber.replace(/[^\w-]/g, "-") || "case"}.txt`;
        a.click();
        URL.revokeObjectURL(url);
        toast({ title: "Document downloaded", description: "Review carefully before filing or sending." });
      } else {
        // Preview
        const res = await fetch("/api/docgen/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const j = await res.json();
          throw new Error(j.error || "Preview failed");
        }
        const data = await res.json();
        setPreview(data.text);
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  if (!me) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground font-body">
        Please sign in to access document generation.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <button onClick={() => navigate("/portal")}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground font-body mb-6 transition-colors">
        <ChevronLeft size={14} /> Back to Portal
      </button>

      <div className="mb-8">
        <h1 className="font-display text-2xl font-semibold mb-2">Document Generation</h1>
        <p className="text-muted-foreground text-sm font-body max-w-2xl">
          Generate §547 demand letters, adversary complaints, and related pleadings pre-populated with your case data.
          All documents require attorney review before filing or service. Templates follow Eleventh Circuit / Florida district practice.
        </p>
      </div>

      {!selectedDoc ? (
        <div className="grid md:grid-cols-2 gap-4">
          {DOC_TYPES.map(d => (
            <Card key={d.id}
              className="cursor-pointer hover:border-[hsl(var(--gold))/60] transition-colors"
              onClick={() => setSelectedDoc(d.id)}>
              <CardContent className="pt-5">
                <div className="flex items-start gap-3">
                  <FileText size={20} className="text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-body font-semibold text-sm mb-1">{d.title}</h3>
                    <p className="text-muted-foreground text-xs leading-relaxed font-body">{d.description}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : preview ? (
        <div>
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setPreview(null)} className="font-body">
              ← Edit Fields
            </Button>
            <Button size="sm" className="bg-navy text-white font-body" onClick={() => handleGenerate(true)} disabled={generating}>
              <Download size={14} className="mr-1" /> Download .txt
            </Button>
            <span className="text-xs text-muted-foreground font-body">Review carefully before filing or service.</span>
          </div>
          <pre className="bg-secondary/40 border border-border rounded-lg p-6 text-xs font-mono whitespace-pre-wrap leading-relaxed overflow-auto max-h-[70vh]">
            {preview}
          </pre>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-8">
          {/* Form */}
          <div>
            <div className="flex items-center gap-3 mb-5">
              <button onClick={() => setSelectedDoc(null)} className="text-muted-foreground hover:text-foreground text-sm font-body transition-colors">
                ← All Documents
              </button>
              <span className="text-muted-foreground">/</span>
              <span className="text-sm font-medium font-body">{doc?.title}</span>
            </div>

            <div className="space-y-3">
              {/* Case Information */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-body mb-2">Case Information</div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Case Number</label>
                  <input value={form.caseNumber} onChange={e => setF("caseNumber", e.target.value)}
                    placeholder="24-12345-BKC-SMG" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Chapter</label>
                  <select value={form.debtorChapter} onChange={e => setF("debtorChapter", e.target.value)} className={inputCls}>
                    <option value="7">Chapter 7</option>
                    <option value="11">Chapter 11</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium font-body mb-1 block">Debtor Name</label>
                <input value={form.debtorName} onChange={e => setF("debtorName", e.target.value)}
                  placeholder="XYZ Corp., a Florida corporation" className={inputCls} />
              </div>

              <div>
                <label className="text-xs font-medium font-body mb-1 block">District</label>
                <input value={form.district} onChange={e => setF("district", e.target.value)} className={inputCls} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Petition Date</label>
                  <input value={form.filingDate} onChange={e => setF("filingDate", e.target.value)}
                    placeholder="January 15, 2024" className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">90-Day Period Start</label>
                  <input value={form.prefPeriodStart} onChange={e => setF("prefPeriodStart", e.target.value)}
                    placeholder="October 17, 2023" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium font-body mb-1 block">2-Year Lookback Start</label>
                <input value={form.lookbackPeriodStart} onChange={e => setF("lookbackPeriodStart", e.target.value)}
                  placeholder="January 15, 2022" className={inputCls} />
              </div>

              {/* Defendant */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-body mt-4 mb-2">Defendant</div>
              <div>
                <label className="text-xs font-medium font-body mb-1 block">Defendant Name</label>
                <input value={form.defendantName} onChange={e => setF("defendantName", e.target.value)}
                  placeholder="ABC Supply Co., Inc." className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium font-body mb-1 block">Defendant Address (optional)</label>
                <input value={form.defendantAddress} onChange={e => setF("defendantAddress", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-medium font-body mb-1 block">Defense Counsel (optional)</label>
                <input value={form.defendantCounsel} onChange={e => setF("defendantCounsel", e.target.value)} className={inputCls} />
              </div>

              {/* Claim */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-body mt-4 mb-2">Claim Details</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Total Claim Amount ($)</label>
                  <input type="number" value={form.claimAmount} onChange={e => setF("claimAmount", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Payment Terms (optional)</label>
                  <input value={form.paymentTerms} onChange={e => setF("paymentTerms", e.target.value)}
                    placeholder="Net 30" className={inputCls} />
                </div>
              </div>

              <div>
                <label className="text-xs font-medium font-body mb-1 block">Transfers (JSON array)</label>
                <textarea rows={6} value={form.paymentsJson} onChange={e => setF("paymentsJson", e.target.value)}
                  className={`${inputCls} font-mono text-xs resize-y`} />
                <p className="text-xs text-muted-foreground font-body mt-1">
                  Format: <code>[{`{"date":"Oct 1, 2023","amount":15000,"description":"Inv #1001"}`}]</code>
                </p>
              </div>

              {/* Extra fields for this doc type */}
              {(doc?.extraFields || []).map((f: any) => (
                <div key={f.key}>
                  <label className="text-xs font-medium font-body mb-1 block">
                    {f.label}{f.optional ? " (optional)" : ""}
                  </label>
                  {f.type === "select" ? (
                    <select value={form[f.key]} onChange={e => setF(f.key, e.target.value)} className={inputCls}>
                      {f.options.map((o: any) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  ) : (
                    <input value={form[f.key] || ""} onChange={e => setF(f.key, e.target.value)} className={inputCls} />
                  )}
                </div>
              ))}

              {/* Plaintiff/Attorney */}
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide font-body mt-4 mb-2">Plaintiff / Attorney</div>
              <div>
                <label className="text-xs font-medium font-body mb-1 block">Attorney Name</label>
                <input value={form.plaintiffAttorney} onChange={e => setF("plaintiffAttorney", e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Bar Number</label>
                  <input value={form.plaintiffBarNumber} onChange={e => setF("plaintiffBarNumber", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-medium font-body mb-1 block">Phone</label>
                  <input value={form.plaintiffPhone} onChange={e => setF("plaintiffPhone", e.target.value)} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium font-body mb-1 block">Email</label>
                <input value={form.plaintiffEmail} onChange={e => setF("plaintiffEmail", e.target.value)} className={inputCls} />
              </div>

              <div className="flex gap-3 pt-3">
                <Button onClick={() => handleGenerate(false)} disabled={generating}
                  variant="outline" className="flex-1 font-body">
                  {generating ? "Generating..." : "Preview"}
                </Button>
                <Button onClick={() => handleGenerate(true)} disabled={generating}
                  className="flex-1 bg-navy text-white font-body">
                  <Download size={14} className="mr-1.5" />
                  {generating ? "Generating..." : "Download .txt"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground font-body leading-relaxed">
                <strong>Important:</strong> Generated documents are templates. Attorney must review, customize facts,
                verify all allegations, and ensure compliance with local rules before filing or service.
              </p>
            </div>
          </div>

          {/* Info panel */}
          <div className="hidden md:block">
            <Card className="sticky top-24">
              <CardHeader>
                <CardTitle className="font-display text-lg">{doc?.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">{doc?.description}</p>
                <div className="space-y-2 text-xs font-body">
                  <div className="font-semibold text-muted-foreground uppercase tracking-wide">Document includes:</div>
                  {selectedDoc === "demand-letter" && [
                    "Certified mail header",
                    "§547(b) legal basis",
                    "Itemized transfer table",
                    "Ordinary course defense analysis",
                    "21-day response deadline",
                    "Adversary complaint threat",
                  ].map(i => <div key={i} className="flex gap-2"><span className="text-gold">✓</span>{i}</div>)}
                  {selectedDoc === "preference-complaint" && [
                    "Full caption and adversary number",
                    "Jurisdiction/venue allegations",
                    "§547(b)(1)–(5) elements",
                    "§550(a) recovery count",
                    "Prayer for pre-judgment interest",
                  ].map(i => <div key={i} className="flex gap-2"><span className="text-gold">✓</span>{i}</div>)}
                  {selectedDoc === "fraudulent-transfer" && [
                    "§548(a)(1)(A) actual fraud count",
                    "§548(a)(1)(B) constructive fraud count",
                    "§550(a) recovery count",
                    "Badges of fraud checklist",
                  ].map(i => <div key={i} className="flex gap-2"><span className="text-gold">✓</span>{i}</div>)}
                  {selectedDoc === "post-petition" && [
                    "§549(a) avoidance count",
                    "§550(a) recovery count",
                    "Post-petition transfer timeline",
                  ].map(i => <div key={i} className="flex gap-2"><span className="text-gold">✓</span>{i}</div>)}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
