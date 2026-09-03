export const EXPENSE_CATEGORIES = [
  'חשמל',
  'ניקיון',
  'מעליות',
  'גינון',
  'ביטוח',
  'תרבות הדיור',
  'בזק/סים כיבוי אש',
  'הדברה',
  'שונות',
];

export const PAID_FROM_OPTIONS = [
  { value: 'CASH', label: 'מזומן' },
  { value: 'BANK', label: 'בנק' },
  { value: 'PAYBOX', label: 'PayBox' },
];

export const TASK_STATUSES = [
  { value: 'OPEN', label: 'פתוח', color: 'bg-red-100 text-red-700' },
  { value: 'IN_PROGRESS', label: 'בטיפול', color: 'bg-amber-100 text-amber-700' },
  { value: 'CONTRACTOR', label: 'הוזמן בעל מקצוע', color: 'bg-purple-100 text-purple-700' },
  { value: 'RESOLVED', label: 'הושלם', color: 'bg-emerald-100 text-emerald-700' },
];

export const RECURRING_CHECKLIST = [
  'בדיקת מעלית חצי שנתית',
  'ביקורת מטפים',
  'שטיפת מאגרי מים',
  'החלפת ריחנים',
];

export const BUDGET_FREQUENCIES = [
  { value: 'MONTHLY', label: 'חודשי' },
  { value: 'BIMONTHLY', label: 'דו-חודשי' },
  { value: 'SEMIANNUAL', label: 'חצי שנתי' },
  { value: 'ANNUAL', label: 'שנתי' },
];
