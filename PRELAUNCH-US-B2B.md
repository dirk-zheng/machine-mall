# U.S. B2B prelaunch gate

This checklist is operational guidance, not a substitute for advice from U.S. counsel.

## Implemented in this version

- Public Privacy Policy, Terms of Use, Privacy Choices, and Privacy Request pages.
- Just-in-time disclosures on registration, public RFQ, signed-in RFQ, and chat.
- Essential visitor ID separated from optional page analytics, with a persistent user opt-out.
- Versioned registration acceptance stored with the visitor-keyed account record.
- Privacy requests stored in MySQL with an admin-only processing queue and identity-verification status.
- Explicit production CORS allowlist, security headers, 64 KB request/WebSocket limits, and HTTP/WebSocket rate limits.
- B2B/18+ representations and automated-assistant/Lark disclosures.
- Twelve-character minimum for newly registered passwords.

## Blocking manual items before public launch

- Replace legal-name and mailing-address placeholders in both server and client production environments.
- Have U.S. counsel approve the Privacy Policy, Terms, governing law, venue, warranty, limitation, and sales documents.
- Assign named owners for privacy requests, security incidents, and cosmetic raw-material compliance; document response procedures.
- Obtain and retain material-specific specifications, INCI, TDS, SDS, representative and lot-specific COAs, origin and regulatory statements, batch/QC, change-control and traceability records before commercial supply.
- Ensure customers understand that finished-formula safety, stability, preservation, claims, packaging compatibility and target-market compliance remain subject to their own validation and applicable agreements.
- Confirm importer of record, Incoterms, tariffs/duties, sanctions screening, state registrations/taxes, and insurance.
- Add MFA for administrators/sellers and migrate browser JWT storage to secure HttpOnly cookies before handling high-value orders.
- Configure encrypted backups, restoration testing, log monitoring, dependency scanning, and an incident-response drill.

Run `npm run check:launch` in the production environment. A passing result covers configuration only; it does not certify legal or product compliance.
