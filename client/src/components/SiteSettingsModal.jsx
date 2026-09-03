import { useEffect, useState } from 'react';
import { X, Settings2 } from 'lucide-react';
import { api } from '../api';

export default function SiteSettingsModal({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { api.getAppSettings().then(setSettings); }, []);

  const toggle = async () => {
    setSaving(true);
    try {
      const updated = await api.updateAppSettings({ showBuildingCountStat: !settings.showBuildingCountStat });
      setSettings(updated);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-sm sm:rounded-2xl rounded-t-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="font-bold text-lg text-slate-800 flex items-center gap-1.5"><Settings2 size={18} /> הגדרות מערכת</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"><X size={20} /></button>
        </div>
        <div className="px-5 py-4">
          {!settings && <p className="text-sm text-slate-500">טוען...</p>}
          {settings && (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-slate-800">הצגת מספר בניינים במסך הכניסה</p>
                <p className="text-xs text-slate-500 mt-0.5">העיגול הירוק שמוצג ליד הלוגו למי שלא מחובר</p>
              </div>
              <button
                onClick={toggle}
                disabled={saving}
                className={`shrink-0 w-11 h-6 rounded-full transition relative ${settings.showBuildingCountStat ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition ${
                    settings.showBuildingCountStat ? 'right-0.5' : 'right-5'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
