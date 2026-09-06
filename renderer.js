const labels = {
  dashboard: 'لوحة التحكم',
  journal: 'القيود اليومية',
  accounts: 'دليل الحسابات',
  reports: 'التقارير المالية',
  sales: 'المبيعات',
  purchases: 'المشتريات',
  inventory: 'المخزون',
  contacts: 'العملاء والموردون'
};

const navItems = document.querySelectorAll('[data-view]');
const dashboard = document.getElementById('dashboard-view');
const generic = document.getElementById('generic-view');
const pageTitle = document.getElementById('page-title');
const genericTitle = document.getElementById('generic-title');
const toast = document.getElementById('toast');

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2200);
}

function switchView(view) {
  document.querySelectorAll('.nav-item').forEach(item => item.classList.toggle('active', item.dataset.view === view));
  if (view === 'dashboard') {
    dashboard.classList.add('active-view');
    generic.style.display = 'none';
    pageTitle.textContent = labels.dashboard;
    return;
  }
  dashboard.classList.remove('active-view');
  generic.style.display = 'block';
  pageTitle.textContent = labels[view] || 'الوحدة';
  genericTitle.textContent = labels[view] || 'الوحدة';
}

navItems.forEach(item => item.addEventListener('click', () => switchView(item.dataset.view)));
document.getElementById('new-entry').addEventListener('click', () => {
  switchView('journal');
  showToast('تم فتح نموذج القيد اليومي الجديد');
});
document.getElementById('generic-action').addEventListener('click', () => showToast('تم تجهيز نموذج الإضافة الجديد'));
document.querySelectorAll('.quick-actions button').forEach(button => button.addEventListener('click', () => {
  switchView(button.dataset.view);
  showToast(`تم فتح وحدة ${labels[button.dataset.view]}`);
}));
document.querySelector('.text-button').addEventListener('click', () => showToast('تم تحميل جميع العمليات'));
document.querySelector('.notification').addEventListener('click', () => showToast('لا توجد إشعارات جديدة'));
document.querySelector('.icon-button').addEventListener('click', () => showToast('البحث العام جاهز للاستخدام'));
