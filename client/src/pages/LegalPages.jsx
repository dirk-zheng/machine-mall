import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import wsClient from '../api/ws';
import { behaviorAPI } from '../api';
import { businessConfig } from '../config/business';
import { clearOptionalLocalData, defaultPrivacyPreferences, getPrivacyPreferences, savePrivacyPreferences } from '../privacy';

function LegalLayout({ eyebrow, title, children }) {
  return (
    <div className="min-h-screen bg-[#fbf8f2] pt-24">
      <header className="bg-[#17251f] px-5 py-14 text-white">
        <div className="mx-auto max-w-4xl"><p className="text-xs font-bold uppercase tracking-[.2em] text-[#e8a182]">{eyebrow}</p><h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">{title}</h1><p className="mt-3 text-sm text-white/60">Effective {businessConfig.effectiveDate}</p></div>
      </header>
      <main className="legal-copy mx-auto max-w-4xl px-5 py-12">{children}</main>
    </div>
  );
}

export function PrivacyPolicy() {
  return <LegalLayout eyebrow="Legal" title="Privacy Policy">
    <p>This policy explains how {businessConfig.legalName} handles information on this business-to-business cosmetic ingredient website.</p>
    <h2>Information we collect</h2><p>We collect an essential visitor identifier, account and authentication details, business contact information, RFQ specifications, support messages, and technical security logs. Site analytics is allowed by default and may collect page-view and interaction events tied to the visitor identifier unless you turn it off in Privacy Choices.</p>
    <h2>Why we use it</h2><p>We use information to provide accounts, maintain RFQs and support conversations, respond to business inquiries, prevent abuse, secure the service, comply with law, and understand site usage. You can turn optional analytics off at any time.</p>
    <h2>Automated assistant and Lark</h2><p>The chat may first be handled by an automated assistant named Kora and then transferred to a human seller. RFQs, support requests, and messages containing contact details may be sent to our Lark workspace so our sales team can respond. Do not send sensitive personal, payment, government ID, health, or confidential third-party information in chat.</p>
    <h2>Sharing and international processing</h2><p>We use service providers for hosting, databases, security, and business communications. Information may be processed outside your state or country, subject to contractual and technical safeguards. We do not sell personal information or share it for cross-context behavioral advertising.</p>
    <h2>Retention and security</h2><p>We retain inquiry and account records only as long as reasonably needed for the business relationship, legal obligations, dispute handling, and security. We use access controls, encryption in transit, rate limits, and audit records; no online service can guarantee absolute security.</p>
    <h2>Your choices</h2><p>You can change optional analytics at any time on <Link to="/privacy-choices">Privacy Choices</Link>. You may request access, correction, deletion, export, or opt-out through our <Link to="/privacy-request">Privacy Request</Link> form. We verify identity before fulfilling a request and may retain records required by law.</p>
    <h2>Children and contact</h2><p>This service is for business representatives age 18 or older and is not directed to children. Privacy questions: <a href={`mailto:${businessConfig.privacyEmail}`}>{businessConfig.privacyEmail}</a>. Mailing address: {businessConfig.postalAddress}.</p>
  </LegalLayout>;
}

export function TermsOfUse() {
  return <LegalLayout eyebrow="Legal" title="Terms of Use">
    <p>These terms govern use of the Aurelia Ingredients website. By creating a technical sourcing account or submitting a business inquiry, you confirm you are at least 18 and authorized to act for the business identified.</p>
    <h2>Business inquiries only</h2><p>The site is intended for professional cosmetic raw-material evaluation, not consumer purchases or medical advice. Specifications, suggested use levels, pack sizes, lead times, pricing and availability are informational until confirmed in a written quotation, approved specification, purchase order acceptance or proforma invoice.</p>
    <h2>Accounts and acceptable use</h2><p>Provide accurate information, protect account credentials, and promptly report unauthorized use. Do not probe security, automate abusive requests, upload unlawful material, impersonate others, or interfere with the service.</p>
    <h2>Samples, orders, and compliance</h2><p>Samples and production goods may vary within agreed tolerances. Binding specifications, labeling, testing, warranties, payment, shipping, returns, and governing terms must appear in the applicable written sales documents. Buyers remain responsible for confirming intended-market requirements.</p>
    <h2>Intellectual property and submissions</h2><p>Site content belongs to {businessConfig.legalName} or its licensors. You may use it only to evaluate cosmetic ingredients and a potential supply relationship. You grant us permission to use submitted business and formulation-brief information to evaluate and fulfill your request.</p>
    <h2>Disclaimers and liability</h2><p>The website is provided “as is” to the extent permitted by law. We do not promise uninterrupted access or that preliminary content is error-free. Liability is limited to the fullest extent permitted by applicable law; rights that cannot legally be waived remain unaffected.</p>
    <h2>Contact</h2><p>Email <a href={`mailto:${businessConfig.inquiriesEmail}`}>{businessConfig.inquiriesEmail}</a>. Mailing address: {businessConfig.postalAddress}. Final governing-law and venue terms must be confirmed by U.S. counsel before launch.</p>
  </LegalLayout>;
}

export function PrivacyChoices() {
  const [prefs, setPrefs] = useState(defaultPrivacyPreferences);
  useEffect(() => { setPrefs(getPrivacyPreferences()); }, []);
  const choose = (analytics) => {
    const next = savePrivacyPreferences({ analytics });
    if (!analytics) clearOptionalLocalData();
    setPrefs(next);
    behaviorAPI.track('privacy.consent_updated', { data: { analytics: next.analytics, policyVersion: next.version } }).catch(() => {});
  };
  return <LegalLayout eyebrow="Privacy" title="Privacy Choices">
    <p>An essential visitor identifier keeps your RFQs, account association, and support conversation connected. It cannot be disabled while using those features. Optional analytics is allowed by default and is currently <strong>{prefs.analytics ? 'allowed' : 'off'}</strong>.</p>
    <div className="mt-8 flex flex-wrap gap-3"><button onClick={() => choose(true)} className="rounded-full bg-[#17251f] px-5 py-3 font-semibold text-white">Allow analytics</button><button onClick={() => choose(false)} className="rounded-full border border-[#17251f]/20 px-5 py-3 font-semibold">Essential only</button></div>
    <p className="mt-8 text-sm">Changing this choice does not delete RFQs, accounts, or support records. Use the <Link to="/privacy-request">Privacy Request</Link> form for a data request.</p>
  </LegalLayout>;
}

export function PrivacyRequest() {
  const [form, setForm] = useState({ email: '', requestType: 'access', details: '', website: '' });
  const [state, setState] = useState({ sending: false, error: '', reference: '' });
  const submit = async (event) => {
    event.preventDefault(); setState({ sending: true, error: '', reference: '' });
    try {
      const response = await fetch('/api/privacy/requests', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Visitor-Id': wsClient.getVisitorId() }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to submit request.');
      setState({ sending: false, error: '', reference: result.data.reference });
    } catch (error) { setState({ sending: false, error: error.message, reference: '' }); }
  };
  return <LegalLayout eyebrow="Privacy" title="Submit a Privacy Request">
    <p>Use this form to request access, correction, deletion, export, or an opt-out. We will verify your identity before acting. Do not include passwords, payment information, or government identifiers.</p>
    <form onSubmit={submit} className="mt-8 space-y-5 rounded-3xl bg-white p-6 shadow-sm sm:p-8">
      <input className="hidden" tabIndex="-1" autoComplete="off" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} aria-hidden="true" />
      <label className="block"><span className="mb-2 block text-sm font-semibold">Business email *</span><input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl" /></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">Request type *</span><select value={form.requestType} onChange={(e) => setForm({ ...form, requestType: e.target.value })} className="w-full rounded-xl"><option value="access">Access my data</option><option value="correct">Correct my data</option><option value="delete">Delete my data</option><option value="export">Export my data</option><option value="opt-out">Opt out of sale/sharing</option></select></label>
      <label className="block"><span className="mb-2 block text-sm font-semibold">Details</span><textarea rows="5" maxLength="1500" value={form.details} onChange={(e) => setForm({ ...form, details: e.target.value })} className="w-full rounded-xl" /></label>
      {state.error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{state.error}</p>}
      {state.reference && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">Request received. Reference: <strong>{state.reference}</strong>. We will verify your identity before processing it.</p>}
      <button disabled={state.sending} className="rounded-full bg-[#17251f] px-6 py-3 font-semibold text-white disabled:opacity-50">{state.sending ? 'Submitting…' : 'Submit request'}</button>
    </form>
  </LegalLayout>;
}
