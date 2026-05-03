import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import {
  Users, FolderOpen, DollarSign, BarChart3, FileText,
  Mail, Eye, CheckCircle, Clock, TrendingUp, ChevronRight,
  Edit2, Save, X, Shield
} from "lucide-react";

const fmt = (n: number | null | undefined) =>
  n != null ? n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }) : "—";

const STATUS_COLORS: Record<string, string> = {
  submitted:     "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  under_review:  "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  offer_pending: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  offer_made:    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed:        "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted", under_review: "Under Review",
  offer_pending: "Offer Pending", offer_made: "Offer Made", closed: "Closed",
};

const inputCls = "w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body";

export default function Admin() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: me } = useQuery<any>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: stats } = useQuery<any>({
    queryKey: ["/api/admin/stats"],
    queryFn: () => apiRequest("GET", "/api/admin/stats").then(r => r.json()),
    enabled: !!me?.isAdmin,
  });

  const { data: allCases = [], isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/cases"],
    queryFn: () => apiRequest("GET", "/api/admin/cases").then(r => r.json()),
    enabled: !!me?.isAdmin,
  });

  const { data: allTrustees = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/trustees"],
    queryFn: () => apiRequest("GET", "/api/admin/trustees").then(r => r.json()),
    enabled: !!me?.isAdmin,
  });

  const { data: allInquiries = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/inquiries"],
    queryFn: () => apiRequest("GET", "/api/admin/inquiries").then(r => r.json()),
    enabled: !!me?.isAdmin,
  });

  // Case editing state
  const [editingCase, setEditingCase] = useState<number | null>(null);
  const [caseForm, setCaseForm] = useState<any>({});

  const updateCase = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PATCH", `/api/admin/cases/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/cases"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
      setEditingCase(null);
      toast({ title: "Case updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const markInquiryRead = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/inquiries/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/inquiries"] });
      qc.invalidateQueries({ queryKey: ["/api/admin/stats"] });
    },
  });

  const toggleAdmin = useMutation({
    mutationFn: ({ id, isAdmin }: { id: number; isAdmin: boolean }) =>
      apiRequest("PATCH", `/api/admin/trustees/${id}`, { isAdmin }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/trustees"] });
      toast({ title: "Trustee updated" });
    },
  });

  if (!me) return (
    <div className="flex items-center justify-center min-h-[60vh] text-muted-foreground font-body">
      Loading...
    </div>
  );

  if (!me.isAdmin) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <Shield size={40} className="text-muted-foreground/30" />
      <div className="text-center">
        <div className="font-body font-semibold mb-1">Admin access required</div>
        <p className="text-sm text-muted-foreground font-body">
          This area is restricted to ClaimIQ administrators.
        </p>
      </div>
      <Button variant="outline" onClick={() => navigate("/portal")} className="font-body">
        Back to Portal
      </Button>
    </div>
  );

  const s = stats;

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield size={18} className="text-[hsl(var(--gold))]" />
            <h1 className="font-display text-2xl font-semibold">Admin Dashboard</h1>
          </div>
          <p className="text-sm text-muted-foreground font-body">
            ClaimIQ internal — all portfolios, trustees, and inquiries
          </p>
        </div>
      </div>

      {/* KPI cards */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: "Trustees",         value: s.trusteeCount,                                  icon: Users },
            { label: "Cases",            value: s.caseCount,                                     icon: FolderOpen },
            { label: "Claims",           value: s.claimStats?.count ?? 0,                        icon: BarChart3 },
            { label: "Total Face",       value: fmt(s.claimStats?.totalFace),                    icon: DollarSign },
            { label: "Total Bid",        value: fmt(s.claimStats?.totalBid),                     icon: TrendingUp },
            { label: "Unread Inquiries", value: s.unreadInquiries,                               icon: Mail },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} data-testid={`card-admin-${label.replace(/\s+/g,"-").toLowerCase()}`}>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-body uppercase tracking-wide mb-1">
                  <Icon size={11} /> {label}
                </div>
                <div className="text-xl font-display font-semibold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Status breakdown */}
      {s?.statusCounts && (
        <div className="flex flex-wrap gap-2 mb-8">
          {Object.entries(s.statusCounts as Record<string, number>).map(([status, count]) => (
            <span key={status} className={`text-xs font-medium px-3 py-1 rounded-full font-body ${STATUS_COLORS[status] || "bg-secondary text-secondary-foreground"}`}>
              {STATUS_LABELS[status] || status}: {count}
            </span>
          ))}
        </div>
      )}

      <Tabs defaultValue="cases">
        <TabsList className="mb-6 font-body flex-wrap h-auto gap-1">
          <TabsTrigger value="cases"><FolderOpen size={13} className="mr-1.5" />All Cases</TabsTrigger>
          <TabsTrigger value="trustees"><Users size={13} className="mr-1.5" />Trustees</TabsTrigger>
          <TabsTrigger value="inquiries">
            <Mail size={13} className="mr-1.5" />
            Inquiries
            {s?.unreadInquiries > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5 leading-none">
                {s.unreadInquiries}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        {/* ── All Cases ── */}
        <TabsContent value="cases">
          {casesLoading ? (
            <div className="text-center py-12 text-muted-foreground font-body">Loading cases...</div>
          ) : (
            <div className="space-y-3">
              {allCases.map((c: any) => (
                <Card key={c.id} data-testid={`card-case-${c.id}`}>
                  <CardContent className="py-4 px-5">
                    {editingCase === c.id ? (
                      /* Edit form */
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div>
                            <label className="text-xs font-medium font-body block mb-1">Status</label>
                            <select value={caseForm.status} onChange={e => setCaseForm((f: any) => ({ ...f, status: e.target.value }))}
                              className={inputCls}>
                              {Object.entries(STATUS_LABELS).map(([v, l]) => (
                                <option key={v} value={v}>{l}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-medium font-body block mb-1">Offer Amount ($)</label>
                            <input type="number" value={caseForm.adminOffer || ""}
                              onChange={e => setCaseForm((f: any) => ({ ...f, adminOffer: e.target.value }))}
                              placeholder="0" className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs font-medium font-body block mb-1">Offer Date</label>
                            <input type="date" value={caseForm.offerDate || ""}
                              onChange={e => setCaseForm((f: any) => ({ ...f, offerDate: e.target.value }))}
                              className={inputCls} />
                          </div>
                          <div>
                            <label className="text-xs font-medium font-body block mb-1">Accepted Date</label>
                            <input type="date" value={caseForm.acceptedDate || ""}
                              onChange={e => setCaseForm((f: any) => ({ ...f, acceptedDate: e.target.value }))}
                              className={inputCls} />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium font-body block mb-1">Admin Notes (shown to trustee)</label>
                          <textarea rows={2} value={caseForm.adminNotes || ""}
                            onChange={e => setCaseForm((f: any) => ({ ...f, adminNotes: e.target.value }))}
                            className={`${inputCls} resize-none`} />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-navy text-white font-body"
                            onClick={() => updateCase.mutate({ id: c.id, data: caseForm })}
                            disabled={updateCase.isPending}>
                            <Save size={13} className="mr-1" /> Save
                          </Button>
                          <Button size="sm" variant="outline" className="font-body" onClick={() => setEditingCase(null)}>
                            <X size={13} className="mr-1" /> Cancel
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display row */
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-body font-semibold text-sm">{c.debtorName}</span>
                            <span className="text-muted-foreground text-xs font-mono">{c.caseNumber}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status] || ""}`}>
                              {STATUS_LABELS[c.status] || c.status}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground font-body flex flex-wrap gap-3">
                            <span>Ch. {c.chapter}</span>
                            {c.district && <span>{c.district}</span>}
                            {c.trustee && <span>Trustee: {c.trustee.firstName} {c.trustee.lastName}{c.trustee.firm ? ` (${c.trustee.firm})` : ""}</span>}
                            <span>{c.claimCount} claim{c.claimCount !== 1 ? "s" : ""}</span>
                            <span>Face: {fmt(c.totalFace)}</span>
                            <span className="text-[hsl(var(--gold))] font-medium">Bid: {fmt(c.totalBid)}</span>
                            {c.adminOffer && <span className="text-green-600 font-medium">Offer: {fmt(c.adminOffer)}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="font-body text-xs"
                            onClick={() => navigate(`/case/${c.id}`)}>
                            <Eye size={12} className="mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" className="font-body text-xs"
                            onClick={() => {
                              setEditingCase(c.id);
                              setCaseForm({
                                status: c.status,
                                adminOffer: c.adminOffer || "",
                                adminNotes: c.adminNotes || "",
                                offerDate: c.offerDate || "",
                                acceptedDate: c.acceptedDate || "",
                              });
                            }}>
                            <Edit2 size={12} className="mr-1" /> Edit
                          </Button>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {allCases.length === 0 && (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl">
                  <FolderOpen size={32} className="text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground font-body">No cases submitted yet.</p>
                </div>
              )}
            </div>
          )}
        </TabsContent>

        {/* ── Trustees ── */}
        <TabsContent value="trustees">
          <div className="space-y-3">
            {allTrustees.map((t: any) => (
              <Card key={t.id} data-testid={`card-trustee-${t.id}`}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-body font-semibold text-sm">{t.firstName} {t.lastName}</span>
                        {t.isAdmin && (
                          <span className="text-xs bg-[hsl(var(--gold))/15] text-[hsl(var(--gold))] border border-[hsl(var(--gold))/30] font-medium px-2 py-0.5 rounded-full">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-body flex gap-2 flex-wrap mt-0.5">
                        <span>{t.email}</span>
                        {t.firm && <span>· {t.firm}</span>}
                        {t.district && <span>· {t.district}</span>}
                        {t.barNumber && <span>· Bar# {t.barNumber}</span>}
                        <span>· Joined {new Date(t.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="font-body text-xs"
                      onClick={() => toggleAdmin.mutate({ id: t.id, isAdmin: !t.isAdmin })}>
                      <Shield size={12} className="mr-1" />
                      {t.isAdmin ? "Remove Admin" : "Make Admin"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {allTrustees.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-body">No trustees registered yet.</div>
            )}
          </div>
        </TabsContent>

        {/* ── Inquiries ── */}
        <TabsContent value="inquiries">
          <div className="space-y-3">
            {allInquiries.map((inq: any) => (
              <Card key={inq.id}
                className={inq.isRead ? "" : "border-[hsl(var(--gold))/50] bg-[hsl(var(--gold))/3]"}
                data-testid={`card-inquiry-${inq.id}`}>
                <CardContent className="py-3 px-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="font-body font-semibold text-sm">{inq.name}</span>
                        {inq.role && <span className="text-xs text-muted-foreground font-body">{inq.role}</span>}
                        {!inq.isRead && (
                          <span className="text-xs bg-[hsl(var(--gold))] text-white font-bold px-1.5 py-0.5 rounded">New</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground font-body flex gap-2 flex-wrap mb-2">
                        <span>{inq.email}</span>
                        {inq.phone && <span>· {inq.phone}</span>}
                        <span>· {new Date(inq.createdAt).toLocaleDateString()}</span>
                      </div>
                      {inq.message && (
                        <p className="text-sm text-muted-foreground font-body leading-relaxed">{inq.message}</p>
                      )}
                    </div>
                    {!inq.isRead && (
                      <Button size="sm" variant="outline" className="font-body text-xs flex-shrink-0"
                        onClick={() => markInquiryRead.mutate(inq.id)}>
                        <CheckCircle size={12} className="mr-1" /> Mark Read
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
            {allInquiries.length === 0 && (
              <div className="text-center py-12 text-muted-foreground font-body">No inquiries yet.</div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
