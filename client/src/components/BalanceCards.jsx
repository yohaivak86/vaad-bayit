import { Wallet, Landmark, Smartphone, PiggyBank } from 'lucide-react';
import { formatILS } from '../format';

const COLORS = {
  blue: 'from-blue-500 to-blue-700',
  purple: 'from-violet-500 to-purple-700',
  amber: 'from-amber-400 to-orange-500',
  emerald: 'from-emerald-500 to-teal-700',
};

// The treasury at a glance - three separate ledgers and their total (committee only).
export default function BalanceCards({ balance }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={Landmark} label="יתרת בנק" value={balance?.bankBalance} color="blue" />
      <Tile icon={Smartphone} label="יתרת PayBox" value={balance?.payboxBalance} color="purple" />
      <Tile icon={PiggyBank} label="קופת מזומן" value={balance?.cashBalance} color="amber" />
      <Tile icon={Wallet} label='סה"כ קופה כללית' value={balance?.totalBalance} color="emerald" big />
    </div>
  );
}

function Tile({ icon: Icon, label, value, color, big }) {
  return (
    <div className={`card-lift relative overflow-hidden rounded-2xl bg-gradient-to-br ${COLORS[color]} p-4 text-white shadow-lg`}>
      <div className="pointer-events-none absolute -left-6 -top-6 h-24 w-24 rounded-full bg-white/15" />
      <div className="pointer-events-none absolute -bottom-8 right-2 h-20 w-20 rounded-full bg-black/10" />
      <div className="relative flex items-center gap-1.5 text-xs font-semibold text-white/85">
        <Icon size={15} /> {label}
      </div>
      <div className={`relative mt-1.5 font-extrabold tracking-tight ${big ? 'text-2xl' : 'text-xl'}`}>{formatILS(value)}</div>
    </div>
  );
}
