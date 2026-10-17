import readXlsxFile from 'read-excel-file';
import { MONTHS_HE } from '../format';

// Reads an Excel sheet of expected recurring / one-time costs and chores into the shape the server's
// /recurring/bulk expects. The first row must be a header row; columns are found by their Hebrew
// (or English) name, in any order:
//   שם | קטגוריה | תדירות (חודשי / שנתי / חד פעמי) | חודש (שנתי) | תאריך (חד פעמי) | סכום צפוי | הערות

const HEADERS = {
  title: ['שם', 'פריט', 'משימה', 'הוצאה', 'תיאור', 'title', 'name'],
  category: ['קטגוריה', 'category'],
  frequency: ['תדירות', 'סוג', 'frequency', 'type'],
  month: ['חודש', 'month'],
  date: ['תאריך', 'date'],
  amount: ['סכום', 'סכום צפוי', 'עלות', 'עלות צפויה', 'amount', 'cost'],
  notes: ['הערות', 'הערה', 'notes'],
};

const norm = (v) => String(v ?? '').trim().toLowerCase();

function findColumns(headerRow) {
  const cols = {};
  headerRow.forEach((cell, i) => {
    const h = norm(cell);
    for (const [key, names] of Object.entries(HEADERS)) {
      if (cols[key] === undefined && names.includes(h)) cols[key] = i;
    }
  });
  return cols;
}

function parseFrequency(raw, hasMonth, hasDate) {
  const f = norm(raw);
  if (f) {
    if (/שנתי|שנה|annual|year/.test(f)) return 'ANNUAL';
    if (/חד|פעם|once|one/.test(f)) return 'ONE_TIME';
    if (/חודש|month/.test(f)) return 'MONTHLY';
    return null;
  }
  if (hasDate) return 'ONE_TIME';
  if (hasMonth) return 'ANNUAL';
  return 'MONTHLY';
}

function parseMonth(raw) {
  if (raw instanceof Date) return raw.getUTCMonth() + 1;
  const n = Number(raw);
  if (Number.isInteger(n) && n >= 1 && n <= 12) return n;
  const idx = MONTHS_HE.findIndex((m) => m === String(raw ?? '').trim());
  return idx >= 0 ? idx + 1 : null;
}

const pad = (n) => String(n).padStart(2, '0');

function parseDate(raw) {
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return `${raw.getUTCFullYear()}-${pad(raw.getUTCMonth() + 1)}-${pad(raw.getUTCDate())}`;
  }
  const s = String(raw ?? '').trim();
  let m = s.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/); // dd/mm/yyyy
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

// Minimal CSV reader (quotes, commas, CRLF) so the downloadable template can be uploaded as-is.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') quoted = false; else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  // empty strings -> null, like the xlsx reader
  return rows.map((r) => r.map((c) => (c === '' ? null : c)));
}

// Returns { items, errors: [{ row, error }] } - `row` is the spreadsheet row number (header = 1).
export async function parseRecurringFile(file) {
  const rows = /\.csv$/i.test(file.name) ? parseCsv(await file.text()) : await readXlsxFile(file);
  if (rows.length < 2) return { items: [], errors: [{ row: 1, error: 'הקובץ ריק - נדרשות שורת כותרות ולפחות שורה אחת' }] };

  const cols = findColumns(rows[0]);
  if (cols.title === undefined) {
    return { items: [], errors: [{ row: 1, error: 'לא נמצאה עמודת "שם". שורת הכותרות צריכה להכיל לפחות: שם' }] };
  }

  const items = [];
  const errors = [];
  rows.slice(1).forEach((r, i) => {
    const rowNo = i + 2;
    const get = (k) => (cols[k] === undefined ? null : r[cols[k]]);
    const title = String(get('title') ?? '').trim();
    if (!title && r.every((c) => c === null || c === '')) return; // blank line

    const monthRaw = get('month');
    const dateRaw = get('date');
    const frequency = parseFrequency(get('frequency'), monthRaw !== null && monthRaw !== '', dateRaw !== null && dateRaw !== '');
    if (!title) return errors.push({ row: rowNo, error: 'חסר שם' });
    if (!frequency) return errors.push({ row: rowNo, error: 'תדירות לא מזוהה (חודשי / שנתי / חד פעמי)' });

    const item = {
      title,
      category: String(get('category') ?? '').trim() || 'אחר',
      frequency,
      expectedAmount: get('amount') === null || get('amount') === '' ? null : Number(get('amount')),
      notes: get('notes') ? String(get('notes')) : null,
    };
    if (item.expectedAmount !== null && !(item.expectedAmount >= 0)) return errors.push({ row: rowNo, error: 'סכום לא תקין' });

    if (frequency === 'ANNUAL') {
      item.month = parseMonth(monthRaw ?? dateRaw);
      if (!item.month) return errors.push({ row: rowNo, error: 'להוצאה שנתית יש לציין חודש (1-12 או שם חודש)' });
    }
    if (frequency === 'ONE_TIME') {
      item.dueDate = parseDate(dateRaw);
      if (!item.dueDate) return errors.push({ row: rowNo, error: 'להוצאה חד פעמית יש לציין תאריך (יום/חודש/שנה)' });
    }
    items.push(item);
  });
  return { items, errors };
}

// A starter file: a CSV with a UTF-8 BOM opens correctly (Hebrew included) in Excel.
export function downloadRecurringTemplate() {
  const lines = [
    ['שם', 'קטגוריה', 'תדירות', 'חודש', 'תאריך', 'סכום צפוי', 'הערות'],
    ['שירות מעלית', 'מעליות', 'חודשי', '', '', '450', ''],
    ['ביטוח בניין', 'ביטוח', 'שנתי', 'מרץ', '', '3200', ''],
    ['הדברה', 'הדברה', 'חד פעמי', '', '15/09/2026', '600', ''],
  ];
  const csv = `﻿${lines.map((l) => l.join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'תבנית-הוצאות-צפויות.csv';
  a.click();
  URL.revokeObjectURL(url);
}
