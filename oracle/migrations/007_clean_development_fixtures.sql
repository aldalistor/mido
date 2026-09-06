alter session set container=XEPDB1;
-- تنظيف fixtures التي أنشأتها اختبارات التطوير فقط
begin
  for r in (select invoice_id from onyx_invoice where invoice_no like 'INV-%' or invoice_no like 'PUR-%') loop delete from onyx_invoice_line where invoice_id=r.invoice_id; end loop;
  delete from onyx_invoice where invoice_no like 'INV-%' or invoice_no like 'PUR-%';
  for r in (select entry_id from onyx_journal_entry where entry_no like 'JV-%') loop delete from onyx_journal_line where entry_id=r.entry_id; end loop;
  delete from onyx_journal_entry where entry_no like 'JV-%';
  delete from onyx_contact where code='C-001';
  delete from onyx_item where item_code='I-001';
  delete from onyx_account where account_code in ('1000','2000');
  for r in (select user_id from onyx_user where username='ADMIN_TEST') loop delete from onyx_user_role where user_id=r.user_id; delete from onyx_login_history where user_id=r.user_id; end loop;
  delete from onyx_user where username='ADMIN_TEST';
  commit;
end;
/
select 'USERS='||count(*) from onyx_user;
select 'ACCOUNTS='||count(*) from onyx_account;
select 'CONTACTS='||count(*) from onyx_contact;
select 'ITEMS='||count(*) from onyx_item;
select 'INVOICES='||count(*) from onyx_invoice;
select 'JOURNALS='||count(*) from onyx_journal_entry;
exit;
