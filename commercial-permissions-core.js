'use strict';

const ROLE_PERMISSIONS = Object.freeze({
  ADMIN: ['*'],
  ACCOUNTANT: ['INVOICE_CREATE', 'INVOICE_EDIT_DRAFT', 'INVOICE_POST', 'PAYMENT_RECORD', 'RETURN_CREATE', 'REPORT_VIEW'],
  SALES: ['INVOICE_CREATE', 'INVOICE_EDIT_DRAFT', 'PAYMENT_RECORD', 'RETURN_CREATE'],
  PURCHASING: ['PURCHASE_CREATE', 'PURCHASE_EDIT_DRAFT', 'PAYMENT_RECORD', 'RETURN_CREATE'],
  VIEWER: ['REPORT_VIEW']
});

function normalizePermissions(permissions = []) {
  return new Set(permissions.map(permission => String(permission).trim().toUpperCase()).filter(Boolean));
}

function permissionsForRole(role) {
  return ROLE_PERMISSIONS[String(role || '').toUpperCase()] || [];
}

function can(permissions, permission) {
  const granted = normalizePermissions(permissions);
  return granted.has('*') || granted.has(String(permission).toUpperCase());
}

function assertCan(permissions, permission) {
  if (!can(permissions, permission)) throw new Error(`لا تملك الصلاحية المطلوبة: ${permission}.`);
  return true;
}

function buildUserPermissions({ roles = [], permissions = [] } = {}) {
  const result = new Set(normalizePermissions(permissions));
  for (const role of roles) for (const permission of permissionsForRole(role)) result.add(permission);
  return [...result];
}

module.exports = { ROLE_PERMISSIONS, permissionsForRole, can, assertCan, buildUserPermissions };
