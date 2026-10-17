import { useEffect } from 'react';
import { X } from 'lucide-react';

// The Lumen modal: a bottom sheet on phones, a centred card on larger screens.
export default function Sheet({ title, onClose, wide = false, children, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center sm:p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className={`sheet ${wide ? 'sheet--wide' : ''}`} dir="rtl">
        <div className="sheet-head">
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="סגירה"><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-body hairline" style={{ flex: 'none' }}>{footer}</div>}
      </div>
    </div>
  );
}
