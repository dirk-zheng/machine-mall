require('dotenv').config();

const failures = [];
const required = (name, label = name) => {
  const value = String(process.env[name] || '').trim();
  if (!value) failures.push(`${label} is required`);
  return value;
};

const legalName = required('LEGAL_BUSINESS_NAME', 'Verified legal business name');
const address = required('BUSINESS_POSTAL_ADDRESS', 'Verified business mailing address');
const corsOrigins = required('CORS_ORIGINS', 'Production CORS origin allowlist');
required('PRIVACY_REQUEST_OWNER', 'Privacy request owner');
required('INCIDENT_RESPONSE_EMAIL', 'Incident response email');
required('PRODUCT_COMPLIANCE_OWNER', 'Product compliance owner');

if (String(process.env.JWT_SECRET || '').length < 32) failures.push('JWT_SECRET must contain at least 32 characters');
if (corsOrigins && (corsOrigins.includes('*') || corsOrigins.split(',').some((origin) => !origin.trim().startsWith('https://')))) failures.push('CORS_ORIGINS must contain only explicit HTTPS origins');
if (!/^https:\/\/open\.larksuite\.com\/open-apis\/bot\/v2\/hook\//.test(String(process.env.LARK_WEBHOOK_URL || ''))) failures.push('A valid international Lark webhook URL is required');
if (!String(process.env.LARK_WEBHOOK_SECRET || '').trim()) failures.push('Lark signing secret is required');
if (/pending|placeholder|todo/i.test(`${legalName} ${address}`)) failures.push('Legal identity fields still contain placeholder text');

if (failures.length) {
  console.error('Launch configuration is NOT ready:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exitCode = 1;
} else {
  console.log('Launch configuration checks passed. Manual legal and product-compliance review is still required.');
}
