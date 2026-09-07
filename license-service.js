'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { signLicense, validateLicense } = require('./license-core');

function readStore(storePath) {
  try { return JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch (error) { if (error.code === 'ENOENT') return { licenses: {}, revoked: {} }; throw error; }
}

function writeStore(storePath, store) {
  fs.mkdirSync(path.dirname(storePath), { recursive: true });
  const temporary = `${storePath}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, JSON.stringify(store, null, 2), { mode: 0o600 });
  fs.renameSync(temporary, storePath);
}

function requireAdmin(secret, expected) {
  const actual = Buffer.from(String(secret || ''));
  const target = Buffer.from(String(expected || ''));
  if (!actual.length || actual.length !== target.length || !crypto.timingSafeEqual(actual, target)) throw new Error('بيانات إدارة التراخيص غير صحيحة.');
}

function issueLicense(input, options = {}) {
  requireAdmin(options.adminSecret, options.expectedAdminSecret);
  const id = String(input.licenseId || crypto.randomUUID());
  const token = signLicense({ product: input.product || 'mido-accounting', tenantId: input.tenantId, plan: input.plan || 'STANDARD', expiresAt: input.expiresAt, seats: input.seats || 1, permissions: input.permissions || [], features: input.features || [], licenseId: id }, options.privateKey);
  const store = readStore(options.storePath);
  store.licenses[id] = { licenseId: id, tenantId: String(input.tenantId), token, revoked: false, updatedAt: new Date().toISOString() };
  delete store.revoked[id];
  writeStore(options.storePath, store);
  return store.licenses[id];
}

function renewLicense(input, options = {}) {
  requireAdmin(options.adminSecret, options.expectedAdminSecret);
  const store = readStore(options.storePath);
  const existing = store.licenses[String(input.licenseId)];
  if (!existing || existing.revoked) throw new Error('الترخيص غير موجود أو مبطل.');
  return issueLicense({ ...input, tenantId: input.tenantId || existing.tenantId, licenseId: existing.licenseId }, options);
}

function revokeLicense(licenseId, options = {}) {
  requireAdmin(options.adminSecret, options.expectedAdminSecret);
  const store = readStore(options.storePath);
  const id = String(licenseId);
  if (!store.licenses[id]) throw new Error('الترخيص غير موجود.');
  store.licenses[id].revoked = true;
  store.revoked[id] = { revokedAt: new Date().toISOString(), reason: options.reason || 'ADMIN_REVOKED' };
  writeStore(options.storePath, store);
  return { licenseId: id, revoked: true };
}

function validateStoredLicense(token, options = {}) {
  const result = validateLicense(token, options);
  if (!result.valid) return result;
  const store = readStore(options.storePath);
  const licenseId = (() => { try { return JSON.parse(Buffer.from(String(token).split('.')[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).licenseId; } catch (_) { return null; } })();
  if (licenseId && store.revoked[licenseId]) return { valid: false, reason: 'LICENSE_REVOKED' };
  return result;
}

module.exports = { issueLicense, renewLicense, revokeLicense, validateStoredLicense, readStore };
