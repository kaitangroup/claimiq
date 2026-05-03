import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  CheckCircle, Clock, DollarSign, BarChart3, FileText,
  Shield, ChevronRight, Scale, Mail, Phone, User
} from "lucide-react";

export default function Landing() {
  const { data: me } = useQuery({ queryKey: ["/api/auth/me"], retry: false });
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "trustee", message: "" });
  const [submitted, setSubmitted] = useState(false);

  const inquiry = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/inquiries", data),
    onSuccess: () => { setSubmitted(true); toast({ title: "Message received", description: "We'll be in touch within one business day." }); },
    onError: () => toast({ title: "Error", description: "Please try again.", variant: "destructive" }),
  });

  return (
    <div className="min-h-screen">

      {/* ── Hero ─────────────────────────────────────────────────── */}
      <section className="bg-navy text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 70% 50%, hsl(42,85%,38%), transparent 60%)" }} />
        <div className="relative max-w-6xl mx-auto px-6 py-24 md:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-1.5 text-sm text-white/80 mb-8 font-body">
              <Scale size={14} className="text-gold" />
              For Chapter 7 Bankruptcy Trustees
            </div>
            <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-semibold text-white leading-tight mb-6">
              Immediate Cash for<br />
              <span className="text-gold">Avoidance Action</span><br />
              Portfolios
            </h1>
            <p className="text-lg text-white/75 mb-4 font-body leading-relaxed max-w-2xl">
              Stop waiting 2–3 years for contingency counsel to resolve preference and fraudulent conveyance claims.
              ClaimIQ purchases your avoidance action portfolio outright — delivering immediate, certain cash
              to the estate with no contingency fees, no delay, and no risk to the estate.
            </p>
            <p className="text-sm text-white/50 mb-10 font-body">
              The purchase of avoidance actions by third-party assignees is recognized in most federal circuits.
              Your counsel can confirm the applicable authority in your jurisdiction.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href={me ? "/portal" : "/auth"}>
                <Button size="lg" className="bg-gold hover:bg-amber-600 text-white font-semibold font-body px-8">
                  Submit a Portfolio
                  <ChevronRight size={16} className="ml-1" />
                </Button>
              </Link>
              <button onClick={() => document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" })}>
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 font-body">
                  How It Works
                </Button>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Problem ────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-3xl font-semibold text-center mb-4">The Problem with Contingency Counsel</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14 font-body">
            The conventional approach to avoidance action recovery costs the estate more than most trustees realize.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { icon: Clock, color: "text-destructive", label: "2–3 Year Wait", desc: "Adversary proceedings and settlement negotiations routinely take two to three years. The estate remains open. Administrative expenses accrue. Creditors wait." },
              { icon: DollarSign, color: "text-warning", label: "30–55% Contingency Cut", desc: "Contingency counsel takes 30–55% of every dollar recovered — before the estate sees a cent. On a $500K portfolio, that's $150K–$275K off the top." },
              { icon: Shield, color: "text-destructive", label: "Full Downside Risk", desc: "If contingency counsel loses or claims settle for less than expected, the estate bears 100% of the shortfall. No recovery means no distribution to creditors." },
            ].map(({ icon: Icon, color, label, desc }) => (
              <Card key={label} className="border-border">
                <CardContent className="pt-6">
                  <Icon size={28} className={`${color} mb-4`} />
                  <h3 className="font-body font-semibold text-lg mb-2">{label}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed font-body">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Solution ───────────────────────────────────────────────── */}
      <section className="py-20 bg-secondary/40" id="how-it-works">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-3xl font-semibold text-center mb-4">The ClaimIQ Solution</h2>
          <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-14 font-body">
            We purchase your avoidance action portfolio outright. The estate receives cash now —
            not a promise of future contingent recovery.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { num: "01", label: "Submit Your Portfolio", desc: "Register, create a case profile, and upload your payment data (Excel or PDF). Our secure portal accepts all standard formats." },
              { num: "02", label: "Free Due Diligence", desc: "Our statistical engine analyzes each claim: standard deviation of payment timing, ordinary course defense strength, estimated recovery — at no charge to the estate." },
              { num: "03", label: "Firm Purchase Offer", desc: "You receive a written offer within 2–5 business days. No obligation. No fee. No cost to the estate regardless of outcome." },
              { num: "04", label: "Immediate Cash", desc: "If the offer is accepted, funds are transferred to the estate. Case closed. Creditors paid. No waiting for litigation to conclude." },
            ].map(({ num, label, desc }) => (
              <div key={num} className="relative">
                <div className="text-5xl font-display font-semibold text-gold/20 mb-3 leading-none">{num}</div>
                <h3 className="font-body font-semibold text-base mb-2">{label}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed font-body">{desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison table */}
          <div className="mt-16 overflow-x-auto">
            <table className="w-full border-collapse text-sm font-body">
              <thead>
                <tr className="bg-navy text-white">
                  <th className="text-left px-5 py-3 font-semibold rounded-tl-lg"> </th>
                  <th className="text-center px-5 py-3 font-semibold text-gold">ClaimIQ Purchase</th>
                  <th className="text-center px-5 py-3 font-semibold rounded-tr-lg">Contingency Counsel</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Cash to estate",         "Immediate upon closing",      "2–3 years after resolution"],
                  ["Estate's share",         "100% of purchase price",     "45–70% after counsel's fee"],
                  ["Downside risk",          "None — estate is paid",      "Full risk if claims fail"],
                  ["Administrative costs",   "Case closes quickly",        "Estate stays open for years"],
                  ["Due diligence cost",     "Free, no obligation",        "N/A (counsel evaluates internally)"],
                  ["Creditor distributions", "Months, not years",          "2–3+ years"],
                ].map(([row, a, b], i) => (
                  <tr key={row} className={i % 2 === 0 ? "bg-background" : "bg-secondary/30"}>
                    <td className="px-5 py-3 font-medium text-foreground">{row}</td>
                    <td className="px-5 py-3 text-center text-green-700 dark:text-green-400 font-medium">{a}</td>
                    <td className="px-5 py-3 text-center text-muted-foreground">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── What We Buy ────────────────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="font-display text-3xl font-semibold text-center mb-4">What We Purchase</h2>
          <p className="text-muted-foreground text-center max-w-xl mx-auto mb-12 font-body">
            We consider all standard avoidance actions and related claims arising in Chapter 7 cases.
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { code: "§ 547", title: "Preference Claims", desc: "Payments made by the debtor within 90 days of filing (or 1 year for insiders) that enabled a creditor to receive more than in a Chapter 7 liquidation." },
              { code: "§ 548", title: "Fraudulent Conveyance", desc: "Transfers made with intent to defraud creditors, or constructively fraudulent transfers for less than reasonably equivalent value." },
              { code: "§ 549", title: "Post-Petition Transfers", desc: "Unauthorized transfers of estate property occurring after the bankruptcy petition was filed." },
              { code: "Contract", title: "Breach of Contract", desc: "Claims against third parties for breach of contracts that constitute property of the estate." },
            ].map(({ code, title, desc }) => (
              <Card key={code} className="border-border hover:border-gold/50 transition-colors">
                <CardContent className="pt-5">
                  <div className="inline-block bg-gold-light text-amber-800 dark:text-amber-300 text-xs font-semibold px-2 py-0.5 rounded mb-3 font-body">
                    {code}
                  </div>
                  <h3 className="font-body font-semibold mb-2">{title}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed font-body">{desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ── Experience ─────────────────────────────────────────────── */}
      <section className="py-20 bg-navy text-white">
        <div className="max-w-5xl mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <div className="text-gold text-sm font-semibold uppercase tracking-widest mb-4 font-body">Our Experience</div>
              <h2 className="font-display text-3xl font-semibold text-white mb-6">
                Twenty Years on Both Sides of These Claims
              </h2>
              <p className="text-white/70 leading-relaxed mb-5 font-body">
                ClaimIQ was founded by a Florida Bar attorney who has spent over twenty years litigating bankruptcy
                avoidance actions — as both plaintiff's counsel and defense counsel. That dual perspective is what
                makes our valuations accurate and our offers fair.
              </p>
              <p className="text-white/70 leading-relaxed mb-8 font-body">
                We understand how defendants evaluate ordinary course defenses. We know which claims settle quickly,
                which require adversary proceedings, and which carry genuine risk of dismissal. That knowledge is
                embedded in every offer we make — ensuring trustees receive a price that reflects true net
                recoverable value.
              </p>
              <div className="grid grid-cols-3 gap-6">
                {[
                  { num: "20+", label: "Years Litigating Avoidance Actions" },
                  { num: "Both", label: "Plaintiff & Defense Experience" },
                  { num: "§§547\n548\n549", label: "All Avoidance Action Types" },
                ].map(({ num, label }) => (
                  <div key={label}>
                    <div className="text-2xl font-display font-semibold text-gold whitespace-pre-line leading-tight">{num}</div>
                    <div className="text-white/50 text-xs mt-1 font-body leading-snug">{label}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              {[
                { icon: BarChart3, title: "Proprietary Statistical Analysis", desc: "Standard deviation analysis, weighted payment averages, and 90-day vs. 2-year timing comparisons — computed automatically the moment you upload data." },
                { icon: Scale, title: "Accurate, Fair Valuations", desc: "Our offers reflect realistic settlement ranges, not inflated numbers designed to win business or discounts that fail to serve the estate." },
                { icon: FileText, title: "Free, No-Obligation Due Diligence", desc: "Full analysis of every claim in your portfolio at no charge to the trustee or the estate — regardless of whether a transaction proceeds." },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="flex gap-4 p-4 bg-white/5 rounded-lg border border-white/10">
                  <Icon size={20} className="text-gold flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-body font-semibold text-white text-sm mb-1">{title}</div>
                    <div className="text-white/60 text-sm font-body leading-relaxed">{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Data Format Guide Preview ───────────────────────────────── */}
      <section className="py-20 bg-secondary/40">
        <div className="max-w-5xl mx-auto px-6 text-center">
          <FileText size={36} className="text-gold mx-auto mb-4" />
          <h2 className="font-display text-3xl font-semibold mb-4">Data Format Guide</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto mb-8 font-body">
            Our portal accepts Excel spreadsheets and PDFs. For fastest processing, use our standardized
            spreadsheet template — we'll walk you through exactly what data we need and in what format.
          </p>
          <div className="grid md:grid-cols-3 gap-5 text-left mb-10">
            {[
              { label: "Payment Amount", desc: "The dollar amount of each payment received from the debtor.", col: "Amount" },
              { label: "Days Late", desc: "How many days after the invoice due date payment was received. Negative = paid early.", col: "DaysLate" },
              { label: "Period", desc: "Whether each payment falls in the 90-day preference window or the 2-year historical window.", col: "Period" },
            ].map(({ label, desc, col }) => (
              <div key={label} className="bg-background border border-border rounded-lg p-4">
                <div className="text-xs font-mono text-gold mb-2 bg-gold-light px-2 py-0.5 rounded inline-block">{col}</div>
                <div className="font-body font-semibold text-sm mb-1">{label}</div>
                <div className="text-muted-foreground text-xs font-body leading-relaxed">{desc}</div>
              </div>
            ))}
          </div>
          <Link href={me ? "/portal" : "/auth"}>
            <Button className="bg-navy hover:bg-navy-mid text-white font-body">
              Access Full Template in the Portal
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Contact ────────────────────────────────────────────────── */}
      <section className="py-20 bg-background" id="contact">
        <div className="max-w-3xl mx-auto px-6">
          <h2 className="font-display text-3xl font-semibold text-center mb-4">Get in Touch</h2>
          <p className="text-muted-foreground text-center mb-10 font-body">
            Questions before submitting? We're happy to discuss your portfolio before you register.
          </p>
          {submitted ? (
            <div className="text-center py-12">
              <CheckCircle size={48} className="text-green-600 mx-auto mb-4" />
              <h3 className="font-display text-xl font-semibold mb-2">Message Received</h3>
              <p className="text-muted-foreground font-body">We'll follow up within one business day.</p>
            </div>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); inquiry.mutate(form); }} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Full Name *</label>
                  <input data-testid="input-name" value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
                    required className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body" />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Email *</label>
                  <input data-testid="input-email" type="email" value={form.email} onChange={e => setForm(f => ({...f, email: e.target.value}))}
                    required className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body" />
                </div>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Phone</label>
                  <input data-testid="input-phone" value={form.phone} onChange={e => setForm(f => ({...f, phone: e.target.value}))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body" />
                </div>
                <div>
                  <label className="text-sm font-medium font-body mb-1 block">Role</label>
                  <select data-testid="select-role" value={form.role} onChange={e => setForm(f => ({...f, role: e.target.value}))}
                    className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body">
                    <option value="trustee">Chapter 7 Trustee</option>
                    <option value="attorney">Bankruptcy Attorney</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium font-body mb-1 block">Message</label>
                <textarea data-testid="input-message" rows={4} value={form.message} onChange={e => setForm(f => ({...f, message: e.target.value}))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring font-body resize-none" />
              </div>
              <Button data-testid="button-submit-contact" type="submit" disabled={inquiry.isPending} className="w-full bg-navy hover:bg-navy-mid text-white font-body">
                {inquiry.isPending ? "Sending..." : "Send Message"}
              </Button>
            </form>
          )}
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────── */}
      <footer className="bg-navy text-white/50 py-10 border-t border-white/10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between gap-4 text-sm font-body">
          <div>
            <div className="text-white font-display font-semibold mb-1">ClaimIQ</div>
            <div>Avoidance Action Finance · North Fort Myers, Florida</div>
          </div>
          <div className="flex flex-col gap-1">
            <div>The purchase of avoidance actions by assignees is subject to jurisdictional variation.</div>
            <div>This website does not constitute legal advice. Consult qualified bankruptcy counsel.</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
