'use strict';

const crypto = require('crypto');

const LICENSE_STATES = Object.freeze({ ACTIVE: 'ACTIVE', GRACE: 'GRACE', EXPIRED: 'EXPIRED', REVOKED: 'REVOKED', INVALID: 'INVALID' });
const PLAN_LIMITS = Object.freeze({
  TRIAL: { maxUsers: 2, maxBranches: 1, features: ['INVOICING', 'REPORTS'] },
  BASIC: { maxUsers: 5, maxBranches: 1, features: ['INVOICING', 'INVENTORY', 'REPORTS'] },
  PROFESSIONAL: { maxUsers: 25, maxBranches: 5, features: ['INVOICING', 'INVENTORY', 'REPORTS', 'PURCHASES', 'SALES_RETURNS', 'PURCHASE_RETURNS', 'AUDIT_TRAIL'] },
  ENTERPRISE: { maxUsers: Infinity, maxBranches: Infinity, features: ['INVOICING', 'INVENTORY', 'REPORTS', 'PURCHASES', 'SALES_RETURNS', 'PURCHASE_RETURNS', 'AUDIT_TRAIL', 'MULTI_BRANCH', 'API'] }
});

function dateOnly(value, label) {
  const raw = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} غير صالح.`);
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} غير صالح.`);
  return raw;
}

function canonicalPayload(license) {
  const { signature, ...unsigned } = license || {};
  return JSON.stringify({
    licenseId: String(unsigned.licenseId || ''), customerId: String(unsigned.customerId || ''), product: String(unsigned.product || ''),
    plan: String(unsigned.plan || '').toUpperCase(), issuedAt: dateOnly(unsigned.issuedAt, 'تاريخ الإصدار'), expiresAt: dateOnly(unsigned.expiresAt, 'تاريخ الانتهاء'),
    graceDays: Number(unsigned.graceDays || 0), maxUsers: Number(unsigned.maxUsers), maxBranches: Number(unsigned.maxBranches),
    features: [...new Set((unsigned.features || []).map(value => String(value).toUpperCase()))].sort()
  });
}

function verifySignature(license, publicKey) {
  if (!publicKey || !license.signature) return false;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(canonicalPayload(license));
  verifier.end();
  return verifier.verify(publicKey, Buffer.from(String(license.signature), 'base64'));
}

function evaluateLicense(license, options = {}) {
  try {
    const now = dateOnly(options.today || new Date().toISOString().slice(0, 10), 'تاريخ التحقق');
    if (!license || !license.licenseId || !license.customerId || !license.product) return { state: LICENSE_STATES.INVALID, reason: 'INCOMPLETE_LICENSE' };
    if (options.publicKey && !verifySignature(license, options.publicKey)) return { state: LICENSE_STATES.INVALID, reason: 'INVALID_SIGNATURE' };
    const issuedAt = dateOnly(license.issuedAt, 'تاريخ الإصدار');
    const expiresAt = dateOnly(license.expiresAt, 'تاريخ الانتهاء');
    if (issuedAt > expiresAt) return { state: LICENSE_STATES.INVALID, reason: 'INVALID_RANGE' };
    if (now < issuedAt) return { state: LICENSE_STATES.INVALID, reason: 'NOT_YET_ACTIVE' };
    if (String(license.revokedAt || '').trim()) return { state: LICENSE_STATES.REVOKED, reason: 'REVOKED' };
    if (now <= expiresAt) return { state: LICENSE_STATES.ACTIVE, reason: 'VALID', daysRemaining: Math.ceil((new Date(`${expiresAt}T00:00:00Z`) - new Date(`${now}T00:00:00Z`)) / 86400000) };
    const graceDays = Math.max(0, Number(license.graceDays || 0));
    const graceEnd = new Date(`${expiresAt}T00:00:00Z`);
    graceEnd.setUTCDate(graceEnd.getUTCDate() + graceDays);
    if (new Date(`${now}T00:00:00Z`) <= graceEnd) return { state: LICENSE_STATES.GRACE, reason: 'GRACE_PERIOD', daysRemaining: Math.ceil((graceEnd - new Date(`${now}T00:00:00Z`)) / 86400000) };
    return { state: LICENSE_STATES.EXPIRED, reason: 'EXPIRED' };
  } catch (error) {
    return { state: LICENSE_STATES.INVALID, reason: 'INVALID_LICENSE' };
  }
}

function hasFeature(license, feature, options = {}) {
  const evaluation = evaluateLicense(license, options);
  if (![LICENSE_STATES.ACTIVE, LICENSE_STATES.GRACE].includes(evaluation.state)) return false;
  return new Set((license.features || []).map(value => String(value).toUpperCase())).has(String(feature).toUpperCase());
}

function enforceEntitlement({ license, feature, currentUsers = 0, currentBranches = 0, options = {} } = {}) {
  const evaluation = evaluateLicense(license, options);
  if (evaluation.state === LICENSE_STATES.INVALID || evaluation.state === LICENSE_STATES.REVOKED) throw new Error(`الترخيص غير صالح: ${evaluation.reason}.`);
  if (evaluation.state === LICENSE_STATES.EXPIRED) throw new Error('انتهت فترة الترخيص. جدّد الترخيص لمتابعة العمليات.');
  if (feature && !hasFeature(license, feature, options)) throw new Error(`الميزة ${feature} غير متاحة في خطة الترخيص الحالية.`);
  if (Number.isFinite(Number(license.maxUsers)) && currentUsers > Number(license.maxUsers)) throw new Error('تجاوز عدد المستخدمين الحد المسموح به في الترخيص.');
  if (Number.isFinite(Number(license.maxBranches)) && currentBranches > Number(license.maxBranches)) throw new Error('تجاوز عدد الفروع الحد المسموح به في الترخيص.');
  return evaluation;
}

function issueTestLicense({ licenseId = 'TEST-1', customerId = 'CUSTOMER-1', plan = 'PROFESSIONAL', issuedAt, expiresAt, graceDays = 7, keyPair } = {}) {
  const defaults = PLAN_LIMITS[String(plan).toUpperCase()] || PLAN_LIMITS.TRIAL;
  const license = { licenseId, customerId, product: 'MIDO', plan: String(plan).toUpperCase(), issuedAt, expiresAt, graceDays, maxUsers: defaults.maxUsers, maxBranches: defaults.maxBranches, features: defaults.features };
  if (keyPair && keyPair.privateKey) {
    const signer = crypto.createSign('RSA-SHA256'); signer.update(canonicalPayload(license)); signer.end(); license.signature = signer.sign(keyPair.privateKey).toString('base64');
  }
  return license;
}

module.exports = { LICENSE_STATES, PLAN_LIMITS, canonicalPayload, verifySignature, evaluateLicense, hasFeature, enforceEntitlement, issueTestLicense };
