set serveroutput on
whenever sqlerror exit sql.sqlcode
merge into onyx_company c using (select distinct cmp_no, max(nvl(cmp_lname, 'شركة Legacy '||cmp_no)) company_name from ONYX_LEGACY_STAGE.S_BRN where cmp_no is not null group by cmp_no) s on (c.company_code='LEGACY-'||s.cmp_no)
when not matched then insert (company_code, company_name_ar, base_currency) values ('LEGACY-'||s.cmp_no, s.company_name, 'SAR');
merge into onyx_branch b using (select distinct brn_no, cmp_no, max(nvl(brn_lname, 'فرع '||brn_no)) branch_name from ONYX_LEGACY_STAGE.S_BRN where brn_no is not null and cmp_no is not null group by brn_no,cmp_no) s on (b.branch_code=to_char(s.brn_no) and b.company_id=(select company_id from onyx_company where company_code='LEGACY-'||s.cmp_no))
when not matched then insert (company_id, branch_code, branch_name_ar) values ((select company_id from onyx_company where company_code='LEGACY-'||s.cmp_no), to_char(s.brn_no), s.branch_name);
merge into onyx_fiscal_year fy using (select distinct cmp_no, brn_year from ONYX_LEGACY_STAGE.S_BRN where cmp_no is not null and brn_year is not null) s on (fy.company_id=(select company_id from onyx_company where company_code='LEGACY-'||s.cmp_no) and fy.fiscal_year=s.brn_year)
when not matched then insert (company_id, fiscal_year, start_date, end_date) values ((select company_id from onyx_company where company_code='LEGACY-'||s.cmp_no), s.brn_year, to_date(s.brn_year||'-01-01','YYYY-MM-DD'), to_date(s.brn_year||'-12-31','YYYY-MM-DD'));
insert into onyx_accounting_control(company_id) select company_id from onyx_company c where not exists (select 1 from onyx_accounting_control x where x.company_id=c.company_id);
commit;
select 'COMPANIES='||count(*) from onyx_company;
select 'BRANCHES='||count(*) from onyx_branch;
select 'FISCAL_YEARS='||count(*) from onyx_fiscal_year;
exit;
