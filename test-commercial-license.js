'use strict';
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { LICENSE_STATES, evaluateLicense, hasFeature, enforceEntitlement, issueTestLicense } = require('./commercial-license-core');
const { can, assertCan, buildUserPermissions } = require('./commercial-permissions-core');

const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
const base = issueTestLicense({ issuedAt: '2026-01-01', expiresAt: '2026-12-31', keyPair });
assert.equal(evaluateLicense(base, { today: '2026-09-07', publicKey: keyPair.publicKey }).state, LICENSE_STATES.ACTIVE);
assert.equal(hasFeature(base, 'SALES_RETURNS', { today: '2026-09-07', publicKey: keyPair.publicKey }), true);
assert.equal(evaluateLicense(base, { today: '2027-01-03', publicKey: keyPair.publicKey }).state, LICENSE_STATES.GRACE);
assert.equal(evaluateLicense(base, { today: '2027-01-10', publicKey: keyPair.publicKey }).state, LICENSE_STATES.EXPIRED);
assert.throws(() => enforceEntitlement({ license: base, feature: 'INVOICING', options: { today: '2027-01-10', publicKey: keyPair.publicKey } }), /انتهت/);
assert.equal(can(buildUserPermissions({ roles: ['ACCOUNTANT'] }), 'INVOICE_POST'), true);
assert.equal(can(buildUserPermissions({ roles: ['SALES'] }), 'INVOICE_POST'), false);
assert.throws(() => assertCan(buildUserPermissions({ roles: ['SALES'] }), 'INVOICE_POST'), /الصلاحية/);
console.log('commercial-license tests passed');
