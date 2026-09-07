'use strict';

const assert = require('node:assert/strict');
const crypto = require('crypto');
const { signLicense, validateLicense, hasLicensedPermission } = require('./license-core');

const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const token = signLicense({ product: 'mido-accounting', tenantId: 'customer-001', plan: 'PRO', expiresAt: '2027-01-31', seats: 5, permissions: ['INVOICE_POST', 'REPORT_VIEW'], features: ['SALES', 'PURCHASES'] }, keys.privateKey);
const license = validateLicense(token, { publicKey: keys.publicKey, now: '2026-09-07T00:00:00Z', requiredFeature: 'SALES' });
assert.equal(license.valid, true);
assert.equal(license.tenantId, 'customer-001');
assert.equal(license.seats, 5);
assert.equal(hasLicensedPermission(license, 'invoice_post'), true);
assert.equal(hasLicensedPermission(license, 'USER_DELETE'), false);
assert.equal(validateLicense(token, { publicKey: keys.publicKey, now: '2027-02-01T00:00:00Z' }).reason, 'LICENSE_EXPIRED');
assert.equal(validateLicense(token, { publicKey: keys.publicKey, now: '2026-09-07T00:00:00Z', requiredFeature: 'INVENTORY' }).reason, 'FEATURE_NOT_LICENSED');
const tampered = `${token.slice(0, -2)}xx`;
assert.equal(validateLicense(tampered, { publicKey: keys.publicKey, now: '2026-09-07T00:00:00Z' }).reason, 'INVALID_SIGNATURE');
console.log('license-core tests passed');
