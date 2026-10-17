import { Wallet, Landmark, Smartphone, PiggyBank, TriangleAlert } from 'lucide-react';
import { formatILS } from '../format';

// The treasury at a glance - three separate ledgers and their total (committee only).
// When the total falls under the committee's red line the total tile turns to the danger colour.
export default function BalanceCards({ balance }) {
  const below = Boolean(balance?.belowRedLine);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={Landmark} label="יתרת בנק" value={balance?.bankBalance} />
      <Tile icon={Smartphone} label="יתרת PayBox" value={balance?.payboxBalance} />
      <Tile icon={PiggyBank} label="קופת מזומן" value={balance?.cashBalance} />
      <Tile icon={Wallet} label='סה"כ קופה כללית' value={balance?.totalBalance} alert={below}>
        {below && (
          <span className="badge badge--danger" title={`הקו האדום: ${formatILS(balance.redLine)}`}>
            <TriangleAlert size={12} /> מתחת לקו האדום ({formatILS(balance.redLine)})
          </span>
        )}
      </Tile>
    </div>
  );
}

function Tile({ icon: Icon, label, value, alert, children }) {
  return (
    <div className={`tile ${alert ? 'tile--alert' : ''}`}>
      <div className="row stat-label"><Icon size={16} /> {label}</div>
      <div className="stat-value">{formatILS(value)}</div>
      {children}
    </div>
  );
}
