'use strict';

const http = require('http');
const { issueLicense, renewLicense, revokeLicense, validateStoredLicense } = require('./license-service');

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function createLicenseServer(options = {}) {
  const server = http.createServer(async (request, response) => {
    if (request.method !== 'POST') return json(response, 405, { error: 'METHOD_NOT_ALLOWED' });
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    let body;
    try { body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (_) { return json(response, 400, { error: 'INVALID_JSON' }); }
    try {
      const common = { ...options, adminSecret: request.headers['x-license-admin-secret'], expectedAdminSecret: process.env.MIDO_LICENSE_ADMIN_SECRET, privateKey: process.env.MIDO_LICENSE_PRIVATE_KEY, storePath: process.env.MIDO_LICENSE_STORE || options.storePath };
      if (request.url === '/issue') return json(response, 201, issueLicense(body, common));
      if (request.url === '/renew') return json(response, 200, renewLicense(body, common));
      if (request.url === '/revoke') return json(response, 200, revokeLicense(body.licenseId, { ...common, reason: body.reason }));
      if (request.url === '/validate') return json(response, 200, validateStoredLicense(body.token, { ...common, publicKey: process.env.MIDO_LICENSE_PUBLIC_KEY }));
      return json(response, 404, { error: 'NOT_FOUND' });
    } catch (error) { return json(response, 400, { error: error.message }); }
  });
  return server;
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  createLicenseServer().listen(port, () => console.log(`mido license server listening on ${port}`));
}

module.exports = { createLicenseServer };
