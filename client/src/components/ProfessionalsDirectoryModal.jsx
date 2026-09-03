import { useEffect, useState } from 'react';
import { X, Wrench, Phone, Mail } from 'lucide-react';
import { api } from '../api';
import { formatDateHe } from '../format';

export default function ProfessionalsDirectoryModal({ onClose }) {
  const [professionals, setProfessionals] = useState(null);

  useEffect(() => {
    api.getProfessionals().then(setProfessionals).catch(() => setProfessionals([]));
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Wrench size={18} /> בעלי מקצוע רשומים</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-2">
          {professionals === null && <p className="text-sm text-slate-500">טוען...</p>}
          {professionals?.map((p) => (
            <div key={p.id} className="border border-slate-200 rounded-xl px-3 py-2.5">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm text-slate-800">{p.name}</p>
                <span className="text-[11px] bg-slate-100 text-slate-600 rounded-full px-2 py-0.5">{p.profession}</span>
              </div>
              {p.message && <p className="text-xs text-slate-500 mt-1">{p.message}</p>}
              <div className="flex items-center gap-3 mt-1.5 text-xs">
                <a href={`tel:${p.phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                  <Phone size={12} /> {p.phone}
                </a>
                {p.email && (
                  <a href={`mailto:${p.email}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                    <Mail size={12} /> {p.email}
                  </a>
                )}
              </div>
              <p className="text-[10px] text-slate-400 mt-1">נרשם ב-{formatDateHe(p.createdAt)}</p>
            </div>
          ))}
          {professionals?.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">אין עדיין בעלי מקצוע רשומים</p>
          )}
        </div>
      </div>
    </div>
  );
}
