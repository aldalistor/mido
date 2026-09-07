'use strict';

function positiveId(value, name) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(`${name} يجب أن يكون رقمًا موجبًا.`);
  return id;
}

function normalizeWorkingDate(value) {
  const date = value ? parseDate(value, 'تاريخ العمل') : new Date();
  return date.toISOString().slice(0, 10);
}

function parseDate(value, label) {
  const raw = String(value == null ? '' : value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} غير صالح.`);
  const date = new Date(`${raw}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== raw) throw new Error(`${label} غير صالح.`);
  return date;
}

function normalizeContext(payload = {}) {
  return {
    companyId: positiveId(payload.companyId, 'الشركة'),
    branchId: positiveId(payload.branchId, 'الفرع'),
    fiscalYearId: positiveId(payload.fiscalYearId, 'السنة المالية'),
    languageCode: String(payload.languageCode || 'ar').trim().toLowerCase(),
    workingDate: normalizeWorkingDate(payload.workingDate),
    terminal: String(payload.terminal || 'Electron').trim().slice(0, 255),
  };
}

function hasPermission(permissions, permission) {
  const granted = new Set((permissions || []).map(value => String(value).toUpperCase()));
  return granted.has(String(permission).toUpperCase()) || granted.has('MANAGE_USERS');
}

function canPostDate(options = {}) {
  let businessDate;
  let postDate;
  try {
    businessDate = parseDate(options.businessDate, 'تاريخ العمل');
    postDate = parseDate(options.postDate, 'تاريخ الترحيل');
  } catch (error) {
    return { allowed: false, reason: 'INVALID_DATE' };
  }
  if (options.periodStatus && String(options.periodStatus).toUpperCase() !== 'OPEN') return { allowed: false, reason: 'PERIOD_CLOSED' };
  let periodStart = null;
  let periodEnd = null;
  try {
    if (options.periodStart) periodStart = parseDate(options.periodStart, 'بداية الفترة');
    if (options.periodEnd) periodEnd = parseDate(options.periodEnd, 'نهاية الفترة');
  } catch (error) {
    return { allowed: false, reason: 'INVALID_PERIOD' };
  }
  if (periodStart && periodEnd && periodStart > periodEnd) return { allowed: false, reason: 'INVALID_PERIOD' };
  if (periodStart && postDate < periodStart) return { allowed: false, reason: 'OUTSIDE_FISCAL_YEAR' };
  if (periodEnd && postDate > periodEnd) return { allowed: false, reason: 'OUTSIDE_FISCAL_YEAR' };
  if (postDate < businessDate) {
    const days = Math.round((businessDate - postDate) / 86400000);
    if (!options.allowBackdate || !hasPermission(options.permissions, 'BACKDATE_POSTING') || days > Number(options.backdateDaysLimit || 0)) return { allowed: false, reason: 'BACKDATE_NOT_ALLOWED', days };
    return { allowed: true, reason: 'BACKDATE_APPROVED', days };
  }
  if (postDate > businessDate && !options.allowFutureDate) return { allowed: false, reason: 'FUTURE_DATE_NOT_ALLOWED' };
  return { allowed: true, reason: 'CURRENT_DATE' };
}

function buildAuditEvent({ userId, companyId, branchId, fiscalYearId, actionCode, entityType, entityId, beforeValue, afterValue, reason } = {}) {
  return {
    userId: userId ? positiveId(userId, 'المستخدم') : null,
    companyId: companyId ? positiveId(companyId, 'الشركة') : null,
    branchId: branchId ? positiveId(branchId, 'الفرع') : null,
    fiscalYearId: fiscalYearId ? positiveId(fiscalYearId, 'السنة المالية') : null,
    actionCode: String(actionCode || '').trim().toUpperCase(),
    entityType: String(entityType || '').trim().toUpperCase(),
    entityId: entityId == null ? null : String(entityId),
    beforeValue: beforeValue == null ? null : JSON.stringify(beforeValue),
    afterValue: afterValue == null ? null : JSON.stringify(afterValue),
    reason: reason == null ? null : String(reason).trim(),
  };
}

module.exports = { normalizeContext, hasPermission, canPostDate, buildAuditEvent, parseDate };
