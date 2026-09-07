'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { issueLicense, renewLicense, revokeLicense, validateStoredLicense } = require('./license-service');

const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const storePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'mido-license-')), 'licenses.json');
const options = { storePath, privateKey: keys.privateKey, publicKey: keys.publicKey, expectedAdminSecret: 'secret', adminSecret: 'secret' };
const issued = issueLicense({ tenantId: 'tenant-1', expiresAt: '2027-01-01', permissions: ['REPORT_VIEW'], features: ['SALES'] }, options);
assert.equal(validateStoredLicense(issued.token, { ...options, now: '2026-09-07T00:00:00Z' }).valid, true);
const renewed = renewLicense({ licenseId: issued.licenseId, expiresAt: '2028-01-01', tenantId: 'tenant-1' }, options);
assert.equal(renewed.licenseId, issued.licenseId);
assert.equal(revokeLicense(issued.licenseId, options).revoked, true);
assert.equal(validateStoredLicense(renewed.token, { ...options, now: '2026-09-07T00:00:00Z' }).reason, 'LICENSE_REVOKED');
console.log('license-service tests passed');
