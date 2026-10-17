import { Building2 } from 'lucide-react';

// ---------------------------------------------------------------------------------------------
// Isometric illustrations (flat three-tone faces give the 3D feel without gradients).
// Colours come from the Lumen tokens through the .iso-* classes in index.css, so both themes work.
// ---------------------------------------------------------------------------------------------

const U = 26; // pixels per isometric unit
const COS = 0.866;
const SIN = 0.5;

// Projects a point of the 3D grid (x grows right-down, y grows left-down, z grows up) onto the page.
const proj = (ox, oy) => (x, y, z) => [ox + (x - y) * COS * U, oy + (x + y) * SIN * U - z * U];
const pts = (list) => list.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

// One box: top + the two faces that face the viewer, with a grid of windows.
function IsoBox({ ox, oy, x = 0, y = 0, w, d, h, z = 0, cols = 2, floors = 5, door = false, ground = false }) {
  const P = proj(ox, oy);
  const top = [P(x, y, z + h), P(x + w, y, z + h), P(x + w, y + d, z + h), P(x, y + d, z + h)];
  const right = [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)];
  const left = [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)];

  const windows = [];
  if (!ground) {
    const padU = 0.28;
    const gapU = 0.18;
    // left face runs along x (width w), right face along y (depth d)
    const face = (run, key, at) => {
      const cw = (run - padU * 2 - gapU * (cols - 1)) / cols;
      const fh = (h - padU * 2 - gapU * (floors - 1)) / floors;
      for (let f = 0; f < floors; f++) {
        for (let c = 0; c < cols; c++) {
          const s0 = padU + c * (cw + gapU);
          const z0 = z + padU + f * (fh + gapU);
          const isDoor = door && key === 'l' && f === 0 && c === Math.floor(cols / 2);
          const quad = [at(s0, z0), at(s0 + cw, z0), at(s0 + cw, z0 + fh), at(s0, z0 + fh)];
          windows.push(<polygon key={`${key}${f}-${c}`} points={pts(quad)} className={isDoor ? 'iso-door' : 'iso-win'} />);
        }
      }
    };
    face(w, 'l', (s, zz) => P(x + s, y + d, zz));
    face(d, 'r', (s, zz) => P(x + w, y + s, zz));
  }

  return (
    <g>
      <polygon points={pts(left)} className={ground ? 'iso-ground-l' : 'iso-left'} />
      <polygon points={pts(right)} className={ground ? 'iso-ground-r' : 'iso-right'} />
      <polygon points={pts(top)} className={ground ? 'iso-ground' : 'iso-top'} />
      {windows}
    </g>
  );
}

// A single apartment building standing on its own plot.
function BuildingScene() {
  const ox = 260;
  const oy = 230;
  return (
    <svg viewBox="0 0 520 420" className="scene-svg" role="img" aria-label="איור: בניין מגורים בודד">
      <g transform="translate(260 215) scale(0.9) translate(-260 -158)">
        <IsoBox ox={ox} oy={oy} x={-5} y={-5} w={10} d={10} h={0.5} ground />
        <IsoBox ox={ox} oy={oy} x={-2} y={-2} w={4} d={4} h={8} z={0.5} cols={3} floors={6} door />
        <IsoBox ox={ox} oy={oy} x={2.6} y={2.8} w={1.8} d={1.8} h={1.2} z={0.5} cols={1} floors={1} ground />
      </g>
    </svg>
  );
}

// Several buildings that share costs - the complex ("מתחם").
function ComplexScene() {
  const ox = 260;
  const oy = 250;
  return (
    <svg viewBox="0 0 520 420" className="scene-svg" role="img" aria-label="איור: מתחם של כמה בניינים">
      <g transform="translate(260 210) scale(0.74) translate(-260 -186)">
        <IsoBox ox={ox} oy={oy} x={-7} y={-7} w={14} d={14} h={0.5} ground />
        {/* shared paths between the buildings - flat, drawn before the buildings so they sit on the ground */}
        <IsoBox ox={ox} oy={oy} x={-2.4} y={-6} w={2.4} d={9.8} h={0.08} z={0.5} ground />
        <IsoBox ox={ox} oy={oy} x={-6} y={-2.4} w={9.8} d={2.4} h={0.08} z={0.5} ground />
        <IsoBox ox={ox} oy={oy} x={-6} y={-6} w={3.6} d={3.6} h={6} z={0.5} cols={2} floors={5} />
        <IsoBox ox={ox} oy={oy} x={0.2} y={-6} w={3.6} d={3.6} h={8.5} z={0.5} cols={2} floors={7} />
        <IsoBox ox={ox} oy={oy} x={-6} y={0.2} w={3.6} d={3.6} h={7} z={0.5} cols={2} floors={6} />
        <IsoBox ox={ox} oy={oy} x={0.2} y={0.2} w={3.6} d={3.6} h={5} z={0.5} cols={2} floors={4} door />
      </g>
    </svg>
  );
}

// `focus`: 'building' | 'complex' - which illustration is in front. Both stay mounted so the swap animates.
export function Illustration({ focus = 'building' }) {
  return (
    <div className="stage" aria-hidden={false}>
      <div className="scene" data-active={focus === 'building'}><BuildingScene /></div>
      <div className="scene" data-active={focus === 'complex'}><ComplexScene /></div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------
// Two-column layout shared by sign-in, sign-up and the "join or open a building" step.
// ---------------------------------------------------------------------------------------------
export default function AuthLayout({ focus = 'building', caption, stats, children }) {
  return (
    <div dir="rtl" className="auth">
      <section className="auth-hero no-print">
        <div className="row" style={{ gap: 'var(--space-3)' }}>
          <div className="chip chip--accent" style={{ width: 44, height: 44, padding: 0, justifyContent: 'center' }}><Building2 size={22} /></div>
          <div>
            <h2 style={{ margin: 0 }}>ועד בית</h2>
            <p className="text-footnote text-secondary" style={{ margin: 0 }}>ניהול עצמי לבניין ולמתחם</p>
          </div>
          {stats?.show && (
            <span className="chip chip--accent" style={{ marginInlineStart: 'auto' }} title="בניינים שכבר מנוהלים במערכת">
              {stats.buildingsCount} בניינים במערכת
            </span>
          )}
        </div>
        <Illustration focus={focus} />
        <p className="auth-caption" key={caption}>{caption}</p>
      </section>

      <main className="auth-panel">{children}</main>
    </div>
  );
}
