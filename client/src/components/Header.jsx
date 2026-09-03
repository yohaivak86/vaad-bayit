import { Building2, Wallet, Landmark, Smartphone, PiggyBank, Plus, ReceiptText, Settings, LayoutGrid, LogOut, Users, Eye } from 'lucide-react';
import { formatILS } from '../format';

export default function Header({ building, balance, onAddExpense, onApprovePayment, onOpenSettings, onManageAdmins, onSwitchBuilding, showSwitch, onLogout, readOnly }) {
  return (
    <div className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm no-print">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <div className="bg-blue-600 text-white rounded-xl p-2 shrink-0">
              <Building2 size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="font-extrabold text-lg text-slate-800 truncate flex items-center gap-1.5">
                {building?.name || 'ועד בית'}
                {readOnly && (
                  <span className="flex items-center gap-1 text-[10px] font-medium bg-slate-100 text-slate-500 rounded-full px-2 py-0.5 shrink-0">
                    <Eye size={11} /> צפייה בלבד
                  </span>
                )}
              </h1>
              <p className="text-xs text-slate-500 truncate">{building?.address}</p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showSwitch && (
              <button
                onClick={onSwitchBuilding}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                title="החלפת בניין"
              >
                <LayoutGrid size={20} />
              </button>
            )}
            {!readOnly && (
              <>
                <button
                  onClick={onManageAdmins}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                  title="ניהול משתמשים"
                >
                  <Users size={20} />
                </button>
                <button
                  onClick={onOpenSettings}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
                  title="הגדרות"
                >
                  <Settings size={20} />
                </button>
              </>
            )}
            <button
              onClick={onLogout}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="התנתקות"
            >
              <LogOut size={20} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 mt-3">
          <SummaryCard icon={Landmark} label="יתרת בנק" value={balance?.bankBalance} color="blue" />
          <SummaryCard icon={Smartphone} label="יתרת PayBox" value={balance?.payboxBalance} color="purple" />
          <SummaryCard icon={PiggyBank} label="יתרת קופת מזומן" value={balance?.cashBalance} color="amber" />
          <SummaryCard icon={Wallet} label='סה"כ קופה כללית' value={balance?.totalBalance} color="emerald" bold />
        </div>

        {!readOnly && (
          <div className="flex gap-2 mt-3">
            <button
              onClick={onAddExpense}
              className="flex-1 flex items-center justify-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg py-2 transition"
            >
              <ReceiptText size={16} />
              רישום הוצאה
            </button>
            <button
              onClick={onApprovePayment}
              className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg py-2 transition"
            >
              <Plus size={16} />
              רישום תשלום דייר
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const COLOR_MAP = {
  blue: 'bg-blue-50 text-blue-700 border-blue-100',
  purple: 'bg-purple-50 text-purple-700 border-purple-100',
  amber: 'bg-amber-50 text-amber-700 border-amber-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

function SummaryCard({ icon: Icon, label, value, color, bold }) {
  return (
    <div className={`rounded-xl border px-2.5 py-2 ${COLOR_MAP[color]}`}>
      <div className="flex items-center gap-1 text-[11px] font-medium opacity-80">
        <Icon size={13} />
        <span className="truncate">{label}</span>
      </div>
      <div className={`mt-0.5 text-sm sm:text-base ${bold ? 'font-extrabold' : 'font-bold'}`}>
        {formatILS(value)}
      </div>
    </div>
  );
}
