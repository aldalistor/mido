-- Commercial invoice fields used by the Electron commercial posting flow
alter session set container=XEPDB1;

alter table onyx_invoice add (
  fiscal_year_id number references onyx_fiscal_year(fiscal_year_id),
  discount_amount number(18,3) default 0 not null,
  payment_method varchar2(12) default 'CREDIT' not null,
  paid_amount number(18,3) default 0 not null,
  outstanding_amount number(18,3) default 0 not null,
  due_date date,
  constraint ck_onyx_invoice_payment check(payment_method in ('CASH','CREDIT','PARTIAL')),
  constraint ck_onyx_invoice_paid check(paid_amount >= 0 and outstanding_amount >= 0)
);

create index ix_onyx_invoice_fiscal on onyx_invoice(company_id, branch_id, fiscal_year_id, invoice_date);
commit;
exit;
