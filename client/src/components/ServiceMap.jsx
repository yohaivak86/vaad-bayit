// A central balloon (the building, or the complex) with provider balloons around it.
// In "complex" mode the member buildings sit on an inner ring and each provider is wired to the
// buildings it serves, so the links between the buildings are visible at a glance.

const PALETTE = ['#2563eb', '#7c3aed', '#059669', '#d97706', '#db2777', '#0891b2', '#dc2626', '#65a30d', '#4f46e5', '#0d9488'];

function colorFor(category) {
  let h = 0;
  for (const ch of category || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function clip(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function polar(cx, cy, r, angle) {
  return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
}

export default function ServiceMap({ centerTitle, centerSubtitle, buildings, providers, selectedId, onSelectProvider, onSelectBuilding, activeBuildingId }) {
  const SIZE = 720;
  const C = SIZE / 2;
  const complexMode = Array.isArray(buildings);

  const buildingPos = {};
  if (complexMode) {
    buildings.forEach((b, i) => {
      const angle = (2 * Math.PI * i) / Math.max(buildings.length, 1) - Math.PI / 2;
      buildingPos[b.id] = polar(C, C, 150, angle);
    });
  }

  const providerRadius = complexMode ? 295 : 235;
  const providerPos = providers.map((p, i) => {
    // In complex mode, start half a building-step off so providers sit between buildings, not behind them.
    const offset = complexMode ? Math.PI / Math.max(buildings.length, 1) : 0;
    const angle = (2 * Math.PI * i) / Math.max(providers.length, 1) - Math.PI / 2 + offset;
    return polar(C, C, providerRadius, angle);
  });

  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto h-auto w-full max-w-[640px] select-none" role="img" aria-label="מפת נותני שירות">
      <defs>
        <radialGradient id="g-center" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#60a5fa" />
          <stop offset="100%" stopColor="#1e40af" />
        </radialGradient>
        <radialGradient id="g-center-complex" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#5b21b6" />
        </radialGradient>
        <radialGradient id="g-building" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#93c5fd" />
          <stop offset="100%" stopColor="#2563eb" />
        </radialGradient>
        <filter id="soft" x="-30%" y="-30%" width="160%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#0f172a" floodOpacity="0.25" />
        </filter>
      </defs>

      {/* links */}
      {complexMode && buildings.map((b) => (
        <line key={`cb-${b.id}`} x1={C} y1={C} x2={buildingPos[b.id].x} y2={buildingPos[b.id].y} stroke="#cbd5e1" strokeWidth="2" />
      ))}
      {providers.map((p, i) => {
        const color = colorFor(p.category);
        const targets = complexMode ? (p.buildingIds || []).filter((id) => buildingPos[id]) : [];
        const dim = selectedId && selectedId !== p.id;
        if (complexMode && targets.length) {
          return targets.map((id) => (
            <line
              key={`pl-${p.id}-${id}`}
              x1={providerPos[i].x} y1={providerPos[i].y} x2={buildingPos[id].x} y2={buildingPos[id].y}
              stroke={color} strokeWidth={selectedId === p.id ? 3.5 : 2} opacity={dim ? 0.15 : 0.7}
            />
          ));
        }
        return (
          <line
            key={`pc-${p.id}`}
            x1={C} y1={C} x2={providerPos[i].x} y2={providerPos[i].y}
            stroke={color} strokeWidth={selectedId === p.id ? 3.5 : 2} opacity={dim ? 0.15 : 0.55}
            strokeDasharray={complexMode ? '6 6' : p.scope === 'COMPLEX' ? '6 6' : undefined}
          />
        );
      })}

      {/* central balloon */}
      <g filter="url(#soft)">
        <circle cx={C} cy={C} r={complexMode ? 70 : 82} fill={complexMode ? 'url(#g-center-complex)' : 'url(#g-center)'} />
        <circle cx={C} cy={C} r={complexMode ? 70 : 82} fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="3" />
        <text x={C} y={C - 4} textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800">{clip(centerTitle || '', 14)}</text>
        <text x={C} y={C + 18} textAnchor="middle" fill="rgba(255,255,255,.8)" fontSize="12">{centerSubtitle}</text>
      </g>

      {/* member buildings (complex mode) */}
      {complexMode && buildings.map((b) => {
        const pos = buildingPos[b.id];
        const active = activeBuildingId === b.id;
        return (
          <g key={`b-${b.id}`} className="bubble" onClick={() => onSelectBuilding?.(b.id)} style={{ cursor: onSelectBuilding ? 'pointer' : 'default' }}>
            <g filter="url(#soft)">
              <circle cx={pos.x} cy={pos.y} r="46" fill="url(#g-building)" stroke={active ? '#fbbf24' : 'rgba(255,255,255,.5)'} strokeWidth={active ? 5 : 3} />
              <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="#fff" fontSize="13" fontWeight="700">{clip(b.name, 11)}</text>
            </g>
          </g>
        );
      })}

      {/* provider balloons */}
      {providers.map((p, i) => {
        const pos = providerPos[i];
        const color = colorFor(p.category);
        const selected = selectedId === p.id;
        const dim = selectedId && !selected;
        return (
          <g key={`p-${p.id}`} className="bubble" onClick={() => onSelectProvider?.(p.id)} opacity={dim ? 0.45 : 1}>
            <g filter="url(#soft)">
              <circle cx={pos.x} cy={pos.y} r={selected ? 50 : 44} fill={color} stroke={selected ? '#fff' : 'rgba(255,255,255,.55)'} strokeWidth={selected ? 5 : 3} strokeDasharray={p.scope === 'COMPLEX' && !complexMode ? '7 5' : undefined} />
              <circle cx={pos.x - 12} cy={pos.y - 14} r="9" fill="rgba(255,255,255,.28)" />
              <text x={pos.x} y={pos.y - 2} textAnchor="middle" fill="#fff" fontSize="12.5" fontWeight="800">{clip(p.name, 10)}</text>
              <text x={pos.x} y={pos.y + 14} textAnchor="middle" fill="rgba(255,255,255,.85)" fontSize="10.5">{clip(p.category, 12)}</text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}
