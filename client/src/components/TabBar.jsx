import { Users, ClipboardList, Receipt, LineChart } from 'lucide-react';

const TABS = [
  { key: 'tenants', label: 'דיירים וגבייה', icon: Users },
  { key: 'tasks', label: 'משימות ותקלות', icon: ClipboardList },
  { key: 'expenses', label: 'הוצאות ותנועות', icon: Receipt },
  { key: 'budget', label: 'תכנון שנתי', icon: LineChart },
];

export default function TabBar({ active, onChange }) {
  return (
    <div className="no-print">
      <div className="hidden sm:flex max-w-6xl mx-auto px-4 gap-1 border-b border-slate-200 bg-white sticky top-[164px] z-20">
        {TABS.map((t) => (
          <TabButton key={t.key} tab={t} active={active === t.key} onClick={() => onChange(t.key)} />
        ))}
      </div>

      <div className="sm:hidden fixed bottom-0 inset-x-0 z-30 bg-white border-t border-slate-200 flex">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                isActive ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon size={20} />
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TabButton({ tab, active, onClick }) {
  const Icon = tab.icon;
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition ${
        active ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon size={16} />
      {tab.label}
    </button>
  );
}
