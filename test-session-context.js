'use strict';

const assert = require('assert');
const { normalizeContext, canPostDate, buildAuditEvent } = require('./session-context');

const context = normalizeContext({ companyId: 1, branchId: 2, fiscalYearId: 3, workingDate: '2026-09-07' });
assert.deepStrictEqual(context, { companyId: 1, branchId: 2, fiscalYearId: 3, languageCode: 'ar', workingDate: '2026-09-07', terminal: 'Electron' });

assert.throws(() => normalizeContext({ companyId: 0, branchId: 2, fiscalYearId: 3 }), /الشركة/);
assert.deepStrictEqual(canPostDate({ businessDate: '2026-09-07', postDate: '2026-09-07', periodStatus: 'OPEN' }).allowed, true);
assert.deepStrictEqual(canPostDate({ businessDate: '2026-09-07', postDate: '2026-09-06', allowBackdate: false, permissions: ['BACKDATE_POSTING'] }).reason, 'BACKDATE_NOT_ALLOWED');
assert.deepStrictEqual(canPostDate({ businessDate: '2026-09-07', postDate: '2026-09-06', allowBackdate: true, backdateDaysLimit: 2, permissions: ['BACKDATE_POSTING'] }).allowed, true);
assert.deepStrictEqual(canPostDate({ businessDate: '2026-09-07', postDate: '2026-09-10', allowFutureDate: false }).reason, 'FUTURE_DATE_NOT_ALLOWED');
assert.deepStrictEqual(canPostDate({ businessDate: '2026-09-07', postDate: '2026-09-07', periodStatus: 'CLOSED' }).reason, 'PERIOD_CLOSED');
const audit = buildAuditEvent({ userId: 7, companyId: 1, branchId: 2, fiscalYearId: 3, actionCode: 'close_period', entityType: 'fiscal_period', entityId: 9, beforeValue: { status: 'OPEN' }, afterValue: { status: 'CLOSED' }, reason: 'إقفال الشهر' });
assert.strictEqual(audit.actionCode, 'CLOSE_PERIOD');
assert.strictEqual(audit.beforeValue, '{"status":"OPEN"}');
console.log('session-context tests passed');
