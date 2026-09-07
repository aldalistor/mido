'use strict';
const assert = require('node:assert/strict');
const { PERIOD_STATUS, CHECK_STATUS, validatePeriodRange, canPostToPeriod, buildCloseChecklist, summarizeCloseResult } = require('./period-close-core');

assert.deepEqual(validatePeriodRange('2026-09-01', '2026-09-30'), { startDate: '2026-09-01', endDate: '2026-09-30' });
assert.throws(() => validatePeriodRange('2026-10-01', '2026-09-30'), /تسبق/);
assert.deepEqual(canPostToPeriod({ statusCode: PERIOD_STATUS.OPEN, startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-09-15'), { allowed: true, reason: null });
assert.equal(canPostToPeriod({ statusCode: PERIOD_STATUS.CLOSED, startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-09-15').reason, 'PERIOD_CLOSED');
assert.equal(canPostToPeriod({ statusCode: PERIOD_STATUS.OPEN, startDate: '2026-09-01', endDate: '2026-09-30' }, '2026-10-01').reason, 'DATE_OUTSIDE_PERIOD');
const result = buildCloseChecklist([{ status: CHECK_STATUS.PASS }, { status: CHECK_STATUS.WARNING }, { status: CHECK_STATUS.FAIL }]);
assert.equal(result.passed, 1);
assert.equal(result.warnings, 1);
assert.equal(result.failed, 1);
assert.equal(summarizeCloseResult(result).canClose, false);
console.log('period close core tests passed');
