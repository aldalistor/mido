alter session set container=XEPDB1;

create or replace trigger trg_onyx_audit_immutable
before update or delete on onyx_audit_log
for each row
begin
  raise_application_error(-20061, 'سجل التدقيق غير قابل للتعديل أو الحذف.');
end;
/

create index ix_onyx_audit_created on onyx_audit_log(created_at, company_id);

commit;
exit;
