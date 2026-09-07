alter session set container=XEPDB1;

merge into onyx_permission p using (
  select 'SUBMIT_INVOICES' permission_code, 'إرسال الفواتير للاعتماد' permission_name from dual union all
  select 'APPROVE_INVOICES', 'اعتماد الفواتير' from dual union all
  select 'RECORD_PAYMENTS', 'تسجيل الدفعات' from dual union all
  select 'CREATE_RETURNS', 'إنشاء المرتجعات' from dual union all
  select 'VIEW_LICENSE', 'عرض حالة الترخيص' from dual
) s on (p.permission_code=s.permission_code)
when not matched then insert(permission_code,permission_name) values(s.permission_code,s.permission_name);

insert into onyx_role_permission(role_id,permission_id)
select r.role_id,p.permission_id
  from onyx_role r cross join onyx_permission p
 where r.role_code='ACCOUNTANT'
   and p.permission_code in ('SUBMIT_INVOICES','RECORD_PAYMENTS','CREATE_RETURNS')
   and not exists (select 1 from onyx_role_permission x where x.role_id=r.role_id and x.permission_id=p.permission_id);

insert into onyx_role_permission(role_id,permission_id)
select r.role_id,p.permission_id
  from onyx_role r cross join onyx_permission p
 where r.role_code='ADMIN'
   and p.permission_code in ('SUBMIT_INVOICES','APPROVE_INVOICES','RECORD_PAYMENTS','CREATE_RETURNS','VIEW_LICENSE')
   and not exists (select 1 from onyx_role_permission x where x.role_id=r.role_id and x.permission_id=p.permission_id);

commit;
exit;
