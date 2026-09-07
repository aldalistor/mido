alter session set container=XEPDB1;
merge into onyx_permission p using (select 'VIEW_DASHBOARD' code, 'عرض لوحة التحكم' name from dual union all select 'VIEW_ACCOUNTS','عرض دليل الحسابات' from dual union all select 'MANAGE_ACCOUNTS','إدارة دليل الحسابات' from dual union all select 'VIEW_CONTACTS','عرض العملاء والموردين' from dual union all select 'MANAGE_CONTACTS','إدارة العملاء والموردين' from dual union all select 'VIEW_INVENTORY','عرض المخزون' from dual union all select 'MANAGE_INVENTORY','إدارة المخزون' from dual union all select 'CREATE_INVOICES','إنشاء الفواتير' from dual union all select 'POST_JOURNALS','ترحيل القيود' from dual union all select 'MANAGE_ROLES','إدارة الأدوار والصلاحيات' from dual union all select 'VIEW_REPORTS','عرض التقارير' from dual union all select 'MANAGE_DATABASE','إدارة قاعدة البيانات' from dual) s on (p.permission_code=s.code)
when not matched then insert (permission_code, permission_name_ar) values (s.code,s.name);
merge into onyx_role r using (select 'ADMIN' code, 'مدير النظام' name from dual union all select 'ACCOUNTANT','محاسب' from dual union all select 'VIEWER','مستخدم قراءة' from dual) s on (r.role_code=s.code)
when not matched then insert (role_code, role_name_ar) values (s.code,s.name);
insert into onyx_role_permission(role_id,permission_id)
select r.role_id,p.permission_id from onyx_role r cross join onyx_permission p where r.role_code='ADMIN' and not exists (select 1 from onyx_role_permission x where x.role_id=r.role_id and x.permission_id=p.permission_id);
insert into onyx_role_permission(role_id,permission_id)
select r.role_id,p.permission_id from onyx_role r join onyx_permission p on p.permission_code in ('LOGIN','VIEW_DASHBOARD','VIEW_ACCOUNTS','VIEW_CONTACTS','VIEW_INVENTORY','CREATE_INVOICES','POST_JOURNALS','VIEW_REPORTS') where r.role_code='ACCOUNTANT' and not exists (select 1 from onyx_role_permission x where x.role_id=r.role_id and x.permission_id=p.permission_id);
insert into onyx_role_permission(role_id,permission_id)
select r.role_id,p.permission_id from onyx_role r join onyx_permission p on p.permission_code in ('LOGIN','VIEW_DASHBOARD','VIEW_ACCOUNTS','VIEW_CONTACTS','VIEW_INVENTORY','VIEW_REPORTS') where r.role_code='VIEWER' and not exists (select 1 from onyx_role_permission x where x.role_id=r.role_id and x.permission_id=p.permission_id);
commit;
exit;
