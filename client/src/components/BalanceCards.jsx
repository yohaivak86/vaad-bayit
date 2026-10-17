import { Wallet, Landmark, Smartphone, PiggyBank, TriangleAlert } from 'lucide-react';
import { formatILS } from '../format';

// The treasury at a glance - three separate ledgers and their total (committee only).
// When the total falls under the committee's red line the total tile turns to the danger colour.
export default function BalanceCards({ balance, onSelect }) {
  const below = Boolean(balance?.belowRedLine);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Tile icon={Landmark} label="יתרת בנק" value={balance?.bankBalance} onClick={onSelect && (() => onSelect('BANK'))} />
      <Tile icon={Smartphone} label="יתרת PayBox" value={balance?.payboxBalance} onClick={onSelect && (() => onSelect('PAYBOX'))} />
      <Tile icon={PiggyBank} label="קופת מזומן" value={balance?.cashBalance} onClick={onSelect && (() => onSelect('CASH'))} />
      <Tile icon={Wallet} label='סה"כ קופה כללית' value={balance?.totalBalance} alert={below} onClick={onSelect && (() => onSelect(''))}>
        {below && (
          <span className="badge badge--danger" title={`הקו האדום: ${formatILS(balance.redLine)}`}>
            <TriangleAlert size={12} /> מתחת לקו האדום ({formatILS(balance.redLine)})
          </span>
        )}
      </Tile>
    </div>
  );
}

function Tile({ icon: Icon, label, value, alert, onClick, children }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick} className={`tile ${alert ? 'tile--alert' : ''} ${onClick ? 'tile--click' : ''}`}>
      <div className="row stat-label"><Icon size={16} /> {label}</div>
      <div className="stat-value">{formatILS(value)}</div>
      {children}
    </Tag>
  );
}
