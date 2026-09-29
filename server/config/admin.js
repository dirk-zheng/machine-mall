module.exports = Object.freeze({
  account: process.env.ADMIN_ACCOUNT || 'admin',
  password: process.env.ADMIN_PASSWORD || 'VendoraAdmin@2026',
  name: process.env.ADMIN_NAME || 'Vendora Systems Admin',
  role: 'admin',
});
