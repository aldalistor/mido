-- Mido original payment terms for trade documents
alter session set container=XEPDB1;

alter table onyx_trade_document add (
  payment_method varchar2(16) default 'CASH' not null,
  due_date date,
  document_note varchar2(1000)
);

alter table onyx_trade_document add constraint ck_onyx_trade_payment check(payment_method in ('CASH','CREDIT','CHEQUE','TRANSFER','MIXED'));
create index ix_onyx_trade_due_date on onyx_trade_document(company_id, branch_id, due_date, status_code);

commit;
exit;
