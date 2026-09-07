'use strict';

const crypto = require('crypto');

function base64UrlEncode(value) {
  return Buffer.from(value).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function base64UrlDecode(value) {
  const normalized = String(value).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - normalized.length % 4) % 4), 'base64');
}

function parseDate(value, label) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} غير صالح.`);
  const date = new Date(`${raw}T23:59:59.999Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} غير صالح.`);
  return date;
}

function normalizePermissions(value) {
  return [...new Set((Array.isArray(value) ? value : []).map(permission => String(permission).trim().toUpperCase()).filter(Boolean))].sort();
}

function signLicense(payload, privateKey) {
  if (!privateKey) throw new Error('مفتاح توقيع الترخيص مطلوب على خادم التراخيص.');
  const header = { alg: 'RS256', typ: 'MIDO-LICENSE' };
  const body = { ...payload, permissions: normalizePermissions(payload.permissions), features: [...new Set((payload.features || []).map(feature => String(feature).trim().toUpperCase()))].sort() };
  const encoded = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(body))}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(encoded);
  signer.end();
  return `${encoded}.${signer.sign(privateKey, 'base64url')}`;
}

function validateLicense(token, options = {}) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) return { valid: false, reason: 'MALFORMED_LICENSE' };
  let header;
  let payload;
  try {
    header = JSON.parse(base64UrlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(base64UrlDecode(parts[1]).toString('utf8'));
  } catch (error) {
    return { valid: false, reason: 'MALFORMED_LICENSE' };
  }
  if (header.alg !== 'RS256' || header.typ !== 'MIDO-LICENSE') return { valid: false, reason: 'UNSUPPORTED_LICENSE' };
  if (!options.publicKey) return { valid: false, reason: 'PUBLIC_KEY_REQUIRED' };
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${parts[0]}.${parts[1]}`);
  verifier.end();
  if (!verifier.verify(options.publicKey, parts[2], 'base64url')) return { valid: false, reason: 'INVALID_SIGNATURE' };
  if (payload.product !== (options.product || 'mido-accounting')) return { valid: false, reason: 'WRONG_PRODUCT' };
  if (payload.tenantId == null || String(payload.tenantId).trim() === '') return { valid: false, reason: 'TENANT_REQUIRED' };
  let expiresAt;
  try { expiresAt = parseDate(payload.expiresAt, 'تاريخ انتهاء الترخيص'); } catch (error) { return { valid: false, reason: 'INVALID_EXPIRY' }; }
  const now = options.now ? new Date(options.now) : new Date();
  if (Number.isNaN(now.getTime())) return { valid: false, reason: 'INVALID_CLOCK' };
  if (expiresAt < now) return { valid: false, reason: 'LICENSE_EXPIRED', expiresAt: payload.expiresAt };
  const permissions = normalizePermissions(payload.permissions);
  const features = [...new Set((payload.features || []).map(feature => String(feature).trim().toUpperCase()))];
  if (options.requiredFeature && !features.includes(String(options.requiredFeature).toUpperCase())) return { valid: false, reason: 'FEATURE_NOT_LICENSED' };
  return { valid: true, tenantId: String(payload.tenantId), plan: String(payload.plan || 'STANDARD'), expiresAt: payload.expiresAt, permissions, features, seats: Number(payload.seats || 1) };
}

function hasLicensedPermission(license, permission) {
  if (!license || !license.valid) return false;
  const required = String(permission || '').trim().toUpperCase();
  return license.permissions.includes('ALL') || license.permissions.includes(required);
}

module.exports = { signLicense, validateLicense, hasLicensedPermission, normalizePermissions };
