'use strict';

const PERIOD_STATUS = Object.freeze({ OPEN: 'OPEN', SOFT_CLOSED: 'SOFT_CLOSED', CLOSED: 'CLOSED', REOPENED: 'REOPENED' });
const CHECK_STATUS = Object.freeze({ PASS: 'PASS', WARNING: 'WARNING', FAIL: 'FAIL' });

function parseDate(value, name) {
  const text = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new Error(`${name} غير صالح.`);
  const date = new Date(`${text}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} غير صالح.`);
  return text;
}

function validatePeriodRange(startDate, endDate) {
  const start = parseDate(startDate, 'تاريخ بداية الفترة');
  const end = parseDate(endDate, 'تاريخ نهاية الفترة');
  if (start > end) throw new Error('بداية الفترة يجب أن تسبق نهايتها.');
  return { startDate: start, endDate: end };
}

function canPostToPeriod(period, postDate) {
  if (!period) return { allowed: false, reason: 'PERIOD_NOT_FOUND' };
  const date = parseDate(postDate, 'تاريخ الترحيل');
  if (![PERIOD_STATUS.OPEN, PERIOD_STATUS.REOPENED].includes(String(period.statusCode || period.status).toUpperCase())) return { allowed: false, reason: 'PERIOD_CLOSED' };
  if (date < String(period.startDate).slice(0, 10) || date > String(period.endDate).slice(0, 10)) return { allowed: false, reason: 'DATE_OUTSIDE_PERIOD' };
  return { allowed: true, reason: null };
}

function buildCloseChecklist(rows = []) {
  return rows.map(row => ({ ...row, status: String(row.status || row.STATUS_CODE || '').toUpperCase() })).map(row => ({ ...row, blocking: row.status === CHECK_STATUS.FAIL })).reduce((result, row) => { result.checks.push(row); if (row.status === CHECK_STATUS.PASS) result.passed += 1; else if (row.status === CHECK_STATUS.FAIL) result.failed += 1; else result.warnings += 1; return result; }, { checks: [], passed: 0, failed: 0, warnings: 0, canClose: true });
}

function summarizeCloseResult(checklist) {
  return { passed: Number(checklist?.passed || 0), failed: Number(checklist?.failed || 0), warnings: Number(checklist?.warnings || 0), canClose: Number(checklist?.failed || 0) === 0 };
}

module.exports = { PERIOD_STATUS, CHECK_STATUS, validatePeriodRange, canPostToPeriod, buildCloseChecklist, summarizeCloseResult };
