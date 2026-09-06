const labels = {
  dashboard: 'لوحة التحكم', journal: 'القيود اليومية', accounts: 'دليل الحسابات',
  reports: 'التقارير المالية', sales: 'المبيعات', purchases: 'المشتريات',
  inventory: 'المخزون', contacts: 'العملاء والموردون'
};

const seed = {
  accounts: [
    { code: '1101', name: 'الصندوق الرئيسي', type: 'أصل', balance: 24500 },
    { code: '1102', name: 'البنك العربي', type: 'أصل', balance: 101990 },
    { code: '1201', name: 'العملاء', type: 'أصل', balance: 58320 },
    { code: '2101', name: 'الموردون', type: 'التزام', balance: 36750 },
    { code: '4101', name: 'إيرادات المبيعات', type: 'إيراد', balance: 184250 },
    { code: '5101', name: 'المصروفات التشغيلية', type: 'مصروف', balance: 42180 }
  ],
  entries: [
    { no: 'JV-0001', date: '2024-09-24', description: 'إثبات فاتورة مبيعات', debit: 12500, credit: 12500, status: 'مرحّل' },
    { no: 'JV-0002', date: '2024-09-23', description: 'فاتورة مشتريات آجلة', debit: 4280, credit: 4280, status: 'مسودة' }
  ],
  invoices: [], items: []
};

const state = JSON.parse(localStorage.getItem('onyx-state') || 'null') || seed;
const save = () => localStorage.setItem('onyx-state', JSON.stringify(state));
const money = value => `${Number(value || 0).toLocaleString('ar-SA')} ر.س`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const $ = id => document.getElementById(id);
const toast = $('toast');
function showToast(message) { toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2200); }

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  document.querySelectorAll('.view').forEach(item => item.classList.remove('active-view'));
  const target = $(view === 'dashboard' ? 'dashboard-view' : 'generic-view');
  target.classList.add('active-view');
  $('page-title').textContent = labels[view] || 'الوحدة';
  $('generic-title').textContent = labels[view] || 'الوحدة';
  if (view !== 'dashboard') renderModule(view);
}

function renderModule(view) {
  const title = labels[view];
  const configs = {
    journal: { action: 'قيد جديد', columns: ['الرقم','التاريخ','البيان','مدين','دائن','الحالة'], rows: state.entries.map(e => [e.no,e.date,e.description,money(e.debit),money(e.credit),`<span class="status ${e.status === 'مرحّل' ? 'paid' : 'pending'}">${e.status}</span>`]) },
    accounts: { action: 'حساب جديد', columns: ['الرمز','اسم الحساب','النوع','الرصيد'], rows: state.accounts.map(a => [a.code,a.name,a.type,money(a.balance)]) },
    sales: { action: 'فاتورة مبيعات', columns: ['المرجع','العميل','التاريخ','الإجمالي','الحالة'], rows: state.invoices.filter(i => i.kind === 'مبيعات').map(i => [i.ref,i.party,i.date,money(i.total),'<span class="status paid">مكتملة</span>']) },
    purchases: { action: 'فاتورة مشتريات', columns: ['المرجع','المورد','التاريخ','الإجمالي','الحالة'], rows: state.invoices.filter(i => i.kind === 'مشتريات').map(i => [i.ref,i.party,i.date,money(i.total),'<span class="status pending">معلّقة</span>']) },
    inventory: { action: 'إضافة صنف', columns: ['الرمز','الصنف','الوحدة','الكمية','سعر التكلفة'], rows: state.items.map(i => [i.code,i.name,i.unit,i.qty,money(i.cost)]) },
    contacts: { action: 'إضافة جهة', columns: ['الاسم','النوع','الهاتف','الرصيد'], rows: [] },
    reports: { action: 'تحديث التقارير', columns: ['التقرير','الفترة','الحالة'], rows: [['قائمة الدخل','الشهر الحالي','جاهز'],['ميزان المراجعة','الشهر الحالي','جاهز'],['أعمار الذمم','الشهر الحالي','جاهز']] }
  };
  const config = configs[view] || configs.reports;
  $('generic-content').innerHTML = `<div class="module-toolbar"><div><p class="eyebrow">إدارة ${esc(title)}</p><h2>${esc(title)}</h2></div><button class="primary-button" id="module-action">＋ ${esc(config.action)}</button></div><div class="panel module-panel"><div class="table-tools"><input id="module-search" placeholder="ابحث في ${esc(title)}..." /><span>${config.rows.length} سجل</span></div><div class="table-scroll"><table><thead><tr>${config.columns.map(c => `<th>${c}</th>`).join('')}</tr></thead><tbody id="module-body">${renderRows(config.rows)}</tbody></table></div></div>`;
  $('module-action').addEventListener('click', () => openForm(view));
  $('module-search').addEventListener('input', event => { const q = event.target.value.toLowerCase(); $('module-body').innerHTML = renderRows(config.rows.filter(row => row.join(' ').toLowerCase().includes(q))); });
}
function renderRows(rows) { return rows.length ? rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="8" class="empty-cell">لا توجد سجلات بعد. أضف أول سجل من الزر أعلاه.</td></tr>`; }

function openForm(view) {
  const titles = { journal:'قيد يومية جديد', accounts:'إضافة حساب', sales:'فاتورة مبيعات جديدة', purchases:'فاتورة مشتريات جديدة', inventory:'إضافة صنف جديد', contacts:'إضافة جهة اتصال', reports:'تحديث التقارير' };
  const form = $('form-modal');
  $('modal-title').textContent = titles[view];
  const fields = view === 'journal' ? [['description','البيان'],['debit','المبلغ المدين','number'],['credit','المبلغ الدائن','number']] : view === 'accounts' ? [['code','رمز الحساب'],['name','اسم الحساب'],['type','نوع الحساب']] : view === 'inventory' ? [['code','رمز الصنف'],['name','اسم الصنف'],['unit','الوحدة'],['qty','الكمية','number'],['cost','سعر التكلفة','number']] : [['party',view === 'purchases' ? 'اسم المورد' : 'اسم العميل'],['total','الإجمالي','number']];
  $('modal-fields').innerHTML = fields.map(([name,label,type='text']) => `<label>${label}<input name="${name}" type="${type}" required /></label>`).join('');
  form.dataset.view = view; form.classList.add('open');
}
function closeForm() { $('form-modal').classList.remove('open'); }
$('modal-close').addEventListener('click', closeForm);
$('modal-cancel').addEventListener('click', closeForm);
$('entry-form').addEventListener('submit', event => {
  event.preventDefault(); const view = event.currentTarget.parentElement.dataset.view; const data = Object.fromEntries(new FormData(event.currentTarget)); const date = new Date().toISOString().slice(0,10);
  if (view === 'journal') state.entries.unshift({ no: `JV-${String(state.entries.length + 1).padStart(4,'0')}`, date, description: data.description, debit: Number(data.debit), credit: Number(data.credit), status: 'مسودة' });
  else if (view === 'accounts') state.accounts.push({ code:data.code, name:data.name, type:data.type, balance:0 });
  else if (view === 'inventory') state.items.push({ code:data.code, name:data.name, unit:data.unit, qty:Number(data.qty), cost:Number(data.cost) });
  else if (['sales','purchases'].includes(view)) state.invoices.unshift({ ref:`${view === 'sales' ? 'INV' : 'PUR'}-${String(state.invoices.length + 1).padStart(4,'0')}`, kind:view === 'sales' ? 'مبيعات' : 'مشتريات', party:data.party, total:Number(data.total), date });
  save(); closeForm(); renderModule(view); showToast('تم حفظ السجل محلياً بنجاح');
});

document.querySelectorAll('[data-view]').forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
$('new-entry').addEventListener('click', () => { switchView('journal'); setTimeout(() => openForm('journal'), 0); });
$('generic-action').addEventListener('click', () => openForm(Object.keys(labels).find(k => labels[k] === $('generic-title').textContent) || 'journal'));
document.querySelectorAll('.quick-actions button').forEach(button => button.addEventListener('click', () => { switchView(button.dataset.view); showToast(`تم فتح وحدة ${labels[button.dataset.view]}`); }));
document.querySelector('.text-button').addEventListener('click', () => { switchView('journal'); showToast('تم تحميل سجل القيود اليومية'); });
document.querySelector('.notification').addEventListener('click', () => showToast('لا توجد إشعارات جديدة'));
document.querySelector('.icon-button').addEventListener('click', () => showToast('استخدم البحث داخل كل وحدة للوصول السريع'));

async function refreshDbStatus() {
  const status = $('db-status');
  if (!status || !window.onyxAPI?.dbTest) return;
  status.classList.add('checking'); status.innerHTML = '<i></i> جارٍ الاتصال';
  try {
    const info = await window.onyxAPI.dbTest();
    status.classList.remove('checking'); status.classList.add('connected'); status.innerHTML = `<i></i> متصل: ${esc(info.DB_USER)}`;
    showToast(`تم الاتصال بقاعدة Oracle عبر ${info.SERVICE_NAME}`);
    return true;
  } catch (error) {
    status.classList.remove('checking', 'connected'); status.innerHTML = '<i></i> غير متصل';
    console.warn('Oracle connection unavailable:', error.message);
    return false;
  }
}
async function loadLiveRows(view) {
  if (!window.onyxAPI) return;
  try {
    let rows = [];
    if (view === 'accounts') rows = await window.onyxAPI.accounts($('module-search')?.value || '');
    if (view === 'contacts') rows = await window.onyxAPI.customers($('module-search')?.value || '');
    if (view === 'journal') rows = await window.onyxAPI.journal(50);
    if (!rows.length || !$('module-body')) return;
    const mapped = view === 'accounts' ? rows.map(a => [a.A_CODE, a.A_NAME, a.A_LEVEL ?? '', money(a.DR)]) : view === 'contacts' ? rows.map(c => [c.C_A_NAME, 'عميل', c.C_PHONE || c.C_MOBILE || '', c.C_E_MAIL || '']) : rows.map(j => [j.DOC_NO || j.JV_NO || '', j.DOC_DATE || j.AD_DATE || '', j.DOC_DESC || j.DESCRIPTION || '', money(j.DEBIT || j.DR), money(j.CREDIT || j.CR), '<span class="status paid">مستورد</span>']);
    $('module-body').innerHTML = renderRows(mapped);
    const count = document.querySelector('.table-tools span'); if (count) count.textContent = `${rows.length} سجل من Oracle`;
  } catch (error) { console.warn('Oracle module read unavailable:', error.message); }
}
const originalSwitchView = switchView;
switchView = function(view) { originalSwitchView(view); setTimeout(() => loadLiveRows(view), 0); };
$('db-status')?.addEventListener('click', refreshDbStatus);
window.addEventListener('DOMContentLoaded', refreshDbStatus);
