// ─── Document Generation Engine ──────────────────────────────────────────────
// Generates §547 preference complaints, §548/§549 complaints, demand letters,
// and standard avoidance action pleadings for ClaimIQ matters.
//
// All templates are production-quality legal documents based on Florida
// Middle/Southern District local rules and Eleventh Circuit practice.
// Attorney must review and customize before filing.

export interface PartyInfo {
  debtorName: string;           // e.g., "XYZ Corp., a Florida corporation"
  debtorChapter: string;        // "7" | "11"
  caseNumber: string;           // e.g., "24-12345-BKC-SMG"
  district: string;             // e.g., "Middle District of Florida, Tampa Division"
  judge?: string;               // e.g., "Catherine Peek McEwen"
  trusteeName: string;          // Chapter 7 trustee / plaintiff-assignee
  adversaryNumber?: string;     // assigned after filing
  defendantName: string;        // full legal name of defendant
  defendantAddress?: string;
  defendantCounsel?: string;
  filingDate: string;           // petition date, e.g., "January 15, 2024"
  prefPeriodStart: string;      // 90 days before petition
  lookbackPeriodStart: string;  // 2 years before petition
  claimAmount: number;          // total preference exposure
  payments: Array<{
    date: string;
    amount: number;
    description?: string;
  }>;
  paymentTerms?: string;        // e.g., "Net 30"
  ordinaryScore?: number;
  defenseStrength?: string;
  bidBasis?: string;
  plaintiffAttorney: string;    // ClaimIQ / assignee counsel
  plaintiffFirm?: string;
  plaintiffAddress?: string;
  plaintiffPhone?: string;
  plaintiffEmail?: string;
  plaintiffBarNumber?: string;
}

const fmt = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });

const today = () => {
  const d = new Date();
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
};

// ─── Demand Letter ────────────────────────────────────────────────────────────
export function generateDemandLetter(p: PartyInfo): string {
  const totalFmt = fmt(p.claimAmount);
  const paymentRows = p.payments.map(
    (pay) => `    ${pay.date}:  ${fmt(pay.amount)}${pay.description ? `  (${pay.description})` : ""}`
  ).join("\n");

  return `${today()}

VIA EMAIL AND CERTIFIED MAIL — RETURN RECEIPT REQUESTED

${p.defendantName}
${p.defendantAddress || "[Address of Defendant]"}
${p.defendantCounsel ? `\nAttention: ${p.defendantCounsel}\n` : ""}

        Re:     In re ${p.debtorName}, Case No. ${p.caseNumber}
                Preference Demand — 11 U.S.C. § 547
                Total Amount at Issue: ${totalFmt}

Dear Sir or Madam${p.defendantCounsel ? ` / ${p.defendantCounsel}` : ""}:

This office represents ${p.trusteeName}, as the duly-appointed trustee (or assignee of avoidance
actions) in the above-referenced Chapter ${p.debtorChapter} bankruptcy case pending in the United
States Bankruptcy Court for the ${p.district}. This letter constitutes a formal demand pursuant
to 11 U.S.C. § 547.

BACKGROUND

On or about ${p.filingDate}, ${p.debtorName} ("Debtor") filed a voluntary petition for relief under
Chapter ${p.debtorChapter} of the United States Bankruptcy Code. As a result, all avoidance rights
vested in the trustee — or have been assigned to the party represented by this office — for the
benefit of the bankruptcy estate and its creditors.

PREFERENCE TRANSFERS

A review of the Debtor's financial records reflects that ${p.defendantName} received the following
payments (the "Transfers") from the Debtor during the preference period — the ninety (90) days
immediately preceding the Petition Date (${p.prefPeriodStart} through ${p.filingDate}):

${paymentRows}

        TOTAL:  ${totalFmt}

Each Transfer was made to or for the benefit of ${p.defendantName}, a creditor of the Debtor at
the time of each Transfer. On information and belief, the Debtor was insolvent during the
preference period. Each Transfer was made on account of an antecedent debt owed by the Debtor
to ${p.defendantName} before the Transfer was made. Each Transfer enabled ${p.defendantName} to
receive more than it would have received in a Chapter 7 liquidation had the Transfer not been made.

Accordingly, each Transfer is avoidable as a preferential transfer under 11 U.S.C. § 547(b).

ORDINARY COURSE ANALYSIS

We have conducted a statistical analysis comparing the payment timing during the preference
period against the two-year historical period (${p.lookbackPeriodStart} through
${p.prefPeriodStart}).${p.bidBasis ? `\n\n${p.bidBasis}` : ""} Based on this analysis,
${p.defenseStrength === "strong"
  ? `the ordinary course defense under § 547(c)(2) appears substantial and the parties may benefit from early resolution.`
  : p.defenseStrength === "moderate"
  ? `the ordinary course defense presents a mixed picture; the parties may benefit from early settlement discussions.`
  : `the Transfers appear to fall outside the Debtor's ordinary course of business, reducing the viability of the ordinary course defense.`
}

DEMAND

Demand is hereby made for payment of the sum of ${totalFmt}, representing the total amount of
all preferential Transfers identified above, within twenty-one (21) days of the date of this
letter.

We are willing to discuss a prompt resolution of this matter without the need for formal
adversary proceedings. However, if we do not receive a substantive response within
twenty-one (21) days, we will file an adversary complaint seeking recovery of the full amount
of the Transfers, plus pre- and post-judgment interest, attorneys' fees to the extent permitted
by law, and all other available relief.

Nothing in this letter constitutes a waiver of any rights, claims, or defenses available to the
estate. All rights and remedies are expressly reserved.

Please direct all correspondence to:

        ${p.plaintiffAttorney}
        ${p.plaintiffFirm || "ClaimIQ Avoidance Action Finance"}
        ${p.plaintiffAddress || "North Fort Myers, Florida"}
        ${p.plaintiffPhone || ""}
        ${p.plaintiffEmail || ""}
        Florida Bar No. ${p.plaintiffBarNumber || "[Bar Number]"}

Very truly yours,

${p.plaintiffAttorney}
${p.plaintiffFirm || "ClaimIQ Avoidance Action Finance"}

[ATTORNEY SIGNATURE BLOCK]

cc:  File
`;
}

// ─── § 547 Preference Complaint ───────────────────────────────────────────────
export function generatePreferenceComplaint(p: PartyInfo): string {
  const totalFmt = fmt(p.claimAmount);
  const paymentAllegations = p.payments.map((pay, i) =>
    `        ${i + 1}.  On or about ${pay.date}, the Debtor transferred ${fmt(pay.amount)} to ${p.defendantName}` +
    `${pay.description ? ` (${pay.description})` : ""} (the "Transfer ${i + 1}").`
  ).join("\n\n");

  return `UNITED STATES BANKRUPTCY COURT
${p.district.toUpperCase()}

In re:                                   )
                                         )  Case No. ${p.caseNumber}
${p.debtorName},                         )
                                         )  Chapter ${p.debtorChapter}
                     Debtor.             )
_________________________________________)
                                         )
${p.trusteeName},                        )
                                         )  Adversary Proc. No. ${p.adversaryNumber || "____________"}
                     Plaintiff,          )
                                         )
        vs.                              )
                                         )
${p.defendantName},                      )
                                         )
                     Defendant.          )
_________________________________________)

                    COMPLAINT TO AVOID AND RECOVER
                  PREFERENTIAL TRANSFERS [11 U.S.C. § 547]

        Plaintiff ${p.trusteeName} ("Plaintiff"), by and through undersigned counsel, hereby files
this Complaint against Defendant ${p.defendantName} ("Defendant"), and alleges as follows:

                              JURISDICTION AND VENUE

        1.  This is an adversary proceeding arising under and related to the bankruptcy case of
${p.debtorName}, Case No. ${p.caseNumber}, pending in the United States Bankruptcy Court for the
${p.district}.

        2.  This Court has subject matter jurisdiction pursuant to 28 U.S.C. §§ 157(a) and
1334(b). This proceeding is a core proceeding pursuant to 28 U.S.C. § 157(b)(2)(F).

        3.  Venue is proper in this district pursuant to 28 U.S.C. § 1409(a).

        4.  Plaintiff consents to entry of a final order by the Bankruptcy Court pursuant to
Stern v. Marshall, 564 U.S. 462 (2011), and its progeny.

                                        PARTIES

        5.  On ${p.filingDate} (the "Petition Date"), ${p.debtorName} ("Debtor") filed a voluntary
petition for relief under Chapter ${p.debtorChapter} of the United States Bankruptcy Code,
11 U.S.C. §§ 101 et seq. (the "Bankruptcy Code").

        6.  Plaintiff is the duly-appointed trustee of the Debtor's bankruptcy estate, or is the
assignee of the Trustee's avoidance powers with respect to the claims set forth herein, having
acquired such rights pursuant to a written Assignment Agreement approved by the Court.

        7.  Defendant ${p.defendantName} is, upon information and belief, a [corporation / limited
liability company / individual] that at all relevant times was a creditor of the Debtor.
${p.defendantAddress ? `Defendant's last known address is ${p.defendantAddress}.` : ""}

                               FACTUAL ALLEGATIONS

        8.  At all times relevant to this Complaint, the Debtor was insolvent within the meaning
of 11 U.S.C. § 101(32), or is presumed to have been insolvent during the ninety (90) days
immediately preceding the Petition Date pursuant to 11 U.S.C. § 547(f).

        9.  The ninety (90)-day period immediately preceding the Petition Date ran from
${p.prefPeriodStart} through ${p.filingDate} (the "Preference Period").

        10. Prior to the Petition Date, the Debtor was indebted to the Defendant on account of
goods sold, services rendered, or other antecedent obligations.
${p.paymentTerms ? `\n        11. The parties' agreed payment terms were approximately ${p.paymentTerms}.\n` : ""}
        ${p.paymentTerms ? "12" : "11"}.  During the Preference Period, the Debtor made the following transfers of property to
or for the benefit of the Defendant (collectively, the "Transfers"):

${paymentAllegations}

        ${p.paymentTerms ? "13" : "12"}.  The total amount of the Transfers is ${totalFmt}.

                                  COUNT I
         AVOIDANCE OF PREFERENTIAL TRANSFERS [11 U.S.C. § 547(b)]

        ${p.paymentTerms ? "14" : "13"}.  Plaintiff re-alleges and incorporates by reference each of the preceding paragraphs
as if fully set forth herein.

        ${p.paymentTerms ? "15" : "14"}.  Each Transfer:

                (a)  was a transfer of an interest of the Debtor in property;

                (b)  was made to or for the benefit of the Defendant, a creditor of the Debtor;

                (c)  was made for or on account of an antecedent debt owed by the Debtor before
                     such Transfer was made;

                (d)  was made while the Debtor was insolvent;

                (e)  was made during the Preference Period; and

                (f)  enabled the Defendant to receive more than it would have received if: (i) the
                     Debtor's case were a case under Chapter 7; (ii) the Transfer had not been
                     made; and (iii) the Defendant had received payment in such case to the extent
                     provided by the Bankruptcy Code.

        ${p.paymentTerms ? "16" : "15"}.  Each Transfer is therefore avoidable as a preferential transfer pursuant to
11 U.S.C. § 547(b).

                                 COUNT II
              RECOVERY OF AVOIDED TRANSFERS [11 U.S.C. § 550(a)]

        ${p.paymentTerms ? "17" : "16"}.  Plaintiff re-alleges and incorporates by reference each of the preceding paragraphs
as if fully set forth herein.

        ${p.paymentTerms ? "18" : "17"}.  The Defendant was the initial transferee of the Transfers or the entity for
whose benefit the Transfers were made within the meaning of 11 U.S.C. § 550(a).

        ${p.paymentTerms ? "19" : "18"}.  Pursuant to 11 U.S.C. § 550(a), Plaintiff is entitled to recover from the
Defendant the value of the Transfers, in the total amount of ${totalFmt}, together with
pre-judgment interest thereon from the date of each Transfer at the applicable federal judgment
rate.

                              PRAYER FOR RELIEF

        WHEREFORE, Plaintiff respectfully requests that this Court enter judgment against
Defendant ${p.defendantName} as follows:

        A.  Finding that each Transfer constitutes an avoidable preferential transfer under
11 U.S.C. § 547(b);

        B.  Avoiding each Transfer pursuant to 11 U.S.C. § 547(b);

        C.  Entering judgment in favor of Plaintiff and against Defendant for the sum of
${totalFmt}, representing the total amount of the Transfers, plus pre-judgment interest at the
federal judgment rate from the date of each Transfer, pursuant to 11 U.S.C. § 550(a);

        D.  Awarding Plaintiff its reasonable attorneys' fees and costs of suit to the extent
permitted by applicable law; and

        E.  Granting Plaintiff such other and further relief as the Court deems just and proper.

        Dated: ${today()}

                                         Respectfully submitted,

                                         ${p.plaintiffAttorney}
                                         ${p.plaintiffFirm || "ClaimIQ Avoidance Action Finance"}
                                         ${p.plaintiffAddress || ""}
                                         ${p.plaintiffPhone || ""}
                                         ${p.plaintiffEmail || ""}
                                         Florida Bar No. ${p.plaintiffBarNumber || "[Bar Number]"}

                                         Counsel for Plaintiff
`;
}

// ─── § 548 Fraudulent Transfer Complaint ─────────────────────────────────────
export function generateFraudulentTransferComplaint(p: PartyInfo & {
  transferDescription: string;
  transferDate: string;
  valueReceived?: string;
  fraudType: "actual" | "constructive";
}): string {
  const totalFmt = fmt(p.claimAmount);
  return `UNITED STATES BANKRUPTCY COURT
${p.district.toUpperCase()}

In re:                                   )
                                         )  Case No. ${p.caseNumber}
${p.debtorName},                         )
                                         )  Chapter ${p.debtorChapter}
                     Debtor.             )
_________________________________________)
                                         )
${p.trusteeName},                        )
                                         )  Adversary Proc. No. ${p.adversaryNumber || "____________"}
                     Plaintiff,          )
                                         )
        vs.                              )
                                         )
${p.defendantName},                      )
                                         )
                     Defendant.          )
_________________________________________)

           COMPLAINT TO AVOID AND RECOVER FRAUDULENT TRANSFER
                           [11 U.S.C. § 548]

        Plaintiff ${p.trusteeName} ("Plaintiff"), by and through undersigned counsel, hereby files
this Complaint against ${p.defendantName} ("Defendant"), and alleges as follows:

                              JURISDICTION AND VENUE

        1–4.  [Same as §547 Complaint, incorporated by reference.]

        1.  This Court has subject matter jurisdiction pursuant to 28 U.S.C. §§ 157 and 1334.
This is a core proceeding pursuant to 28 U.S.C. § 157(b)(2)(H).

        2.  Venue is proper pursuant to 28 U.S.C. § 1409(a).

                                        PARTIES

        3.  On ${p.filingDate}, ${p.debtorName} ("Debtor") filed a voluntary petition for
Chapter ${p.debtorChapter} relief.

        4.  Plaintiff is the Trustee of the Debtor's estate, or the assignee of the Trustee's
avoidance rights as set forth above.

        5.  Defendant ${p.defendantName} is the transferee of the transfer described herein.

                               FACTUAL ALLEGATIONS

        6.  On or about ${p.transferDate}, within the two (2) years prior to the Petition Date
(${p.filingDate}), the Debtor transferred ${totalFmt} (or its equivalent in property) to or for
the benefit of the Defendant: ${p.transferDescription} (the "Transfer").

${p.fraudType === "constructive" ? `
        7.  The Debtor received less than reasonably equivalent value in exchange for the
Transfer. ${p.valueReceived ? `The Debtor received only: ${p.valueReceived}.` : "The Debtor received little or no value in exchange."}

        8.  At the time of the Transfer, the Debtor:

                (a)  was insolvent, or became insolvent as a result of the Transfer;

                (b)  was engaged in business or a transaction for which the property remaining
                     after the Transfer was an unreasonably small capital; or

                (c)  intended to incur, or believed it would incur, debts beyond its ability to
                     pay as they matured.
` : `
        7.  The Transfer was made with actual intent to hinder, delay, or defraud one or more
of the Debtor's creditors, as evidenced by the badges of fraud present in the transaction,
including without limitation:

                (a)  the Transfer was made to an insider;
                (b)  the Debtor was insolvent at the time of the Transfer;
                (c)  the Debtor received less than reasonably equivalent value;
                (d)  [additional badges of fraud to be specified].
`}

                                    COUNT I
         AVOIDANCE OF FRAUDULENT TRANSFER [11 U.S.C. § 548(a)(1)${p.fraudType === "constructive" ? "(B)" : "(A)"}]

        9.  Plaintiff re-alleges all preceding paragraphs.

        10. The Transfer is avoidable as a fraudulent transfer pursuant to 11 U.S.C.
§ 548(a)(1)${p.fraudType === "constructive" ? "(B)" : "(A)"} because [the Debtor${p.fraudType === "actual" ? " made it with actual intent to hinder, delay, or defraud creditors" : " received less than reasonably equivalent value and was insolvent"}].

                                    COUNT II
              RECOVERY OF AVOIDED TRANSFER [11 U.S.C. § 550(a)]

        11.  Pursuant to 11 U.S.C. § 550(a), Plaintiff is entitled to recover the value of the
Transfer, in the amount of ${totalFmt}, from the Defendant.

                              PRAYER FOR RELIEF

        WHEREFORE, Plaintiff respectfully requests:

        A.  An order avoiding the Transfer pursuant to 11 U.S.C. § 548(a)(1)${p.fraudType === "constructive" ? "(B)" : "(A)"};
        B.  Judgment against Defendant for ${totalFmt} plus pre-judgment interest;
        C.  Attorneys' fees and costs to the extent permitted by law;
        D.  Such other and further relief as the Court deems just and proper.

        Dated: ${today()}

                                         Respectfully submitted,

                                         ${p.plaintiffAttorney}
                                         ${p.plaintiffFirm || "ClaimIQ Avoidance Action Finance"}
                                         Florida Bar No. ${p.plaintiffBarNumber || "[Bar Number]"}
`;
}

// ─── § 549 Post-Petition Transfer Complaint ───────────────────────────────────
export function generatePostPetitionComplaint(p: PartyInfo & {
  transferDate: string;
  transferDescription: string;
  courtAuthorization?: boolean;
}): string {
  const totalFmt = fmt(p.claimAmount);
  return `UNITED STATES BANKRUPTCY COURT
${p.district.toUpperCase()}

In re:                                   )
                                         )  Case No. ${p.caseNumber}
${p.debtorName},                         )
                                         )  Chapter ${p.debtorChapter}
                     Debtor.             )
_________________________________________)
                                         )
${p.trusteeName},                        )
                                         )  Adversary Proc. No. ${p.adversaryNumber || "____________"}
                     Plaintiff,          )
                                         )
        vs.                              )
                                         )
${p.defendantName},                      )
                                         )
                     Defendant.          )
_________________________________________)

         COMPLAINT TO AVOID AND RECOVER POST-PETITION TRANSFER
                        [11 U.S.C. § 549]

        Plaintiff ${p.trusteeName}, by and through undersigned counsel, alleges:

                              JURISDICTION AND VENUE

        1.  Jurisdiction and venue are proper as set forth in the companion §547 complaint
template, which is incorporated herein by reference.

                                        PARTIES

        2.  The Debtor filed for Chapter ${p.debtorChapter} relief on ${p.filingDate}.

        3.  Plaintiff is the Trustee or assignee of the Trustee's avoidance rights.

        4.  Defendant ${p.defendantName} is the recipient of the post-petition transfer described
herein.

                               FACTUAL ALLEGATIONS

        5.  After the Petition Date of ${p.filingDate}, on or about ${(p as any).transferDate},
the Debtor transferred ${totalFmt} (or its equivalent in property) to or for the benefit of
the Defendant: ${(p as any).transferDescription} (the "Post-Petition Transfer").

        6.  The Post-Petition Transfer was not authorized by this Court or by the Bankruptcy Code.

                                    COUNT I
              AVOIDANCE OF POST-PETITION TRANSFER [11 U.S.C. § 549]

        7.  The Post-Petition Transfer is avoidable pursuant to 11 U.S.C. § 549(a) because it
was a transfer of property of the estate that occurred after the commencement of the case and
was not authorized under the Bankruptcy Code or by the Court.

                                    COUNT II
              RECOVERY OF AVOIDED TRANSFER [11 U.S.C. § 550(a)]

        8.  Pursuant to 11 U.S.C. § 550(a), Plaintiff is entitled to recover the value of the
Post-Petition Transfer, in the amount of ${totalFmt}, from the Defendant.

                              PRAYER FOR RELIEF

        WHEREFORE, Plaintiff respectfully requests:

        A.  An order avoiding the Post-Petition Transfer pursuant to 11 U.S.C. § 549;
        B.  Judgment against Defendant for ${totalFmt} plus interest;
        C.  Attorneys' fees and costs to the extent permitted by law;
        D.  Such other and further relief as just and proper.

        Dated: ${today()}

                                         ${p.plaintiffAttorney}
                                         ${p.plaintiffFirm || "ClaimIQ Avoidance Action Finance"}
                                         Florida Bar No. ${p.plaintiffBarNumber || "[Bar Number]"}
`;
}
