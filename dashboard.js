/* ============================================================
   SRC 100 Day Challenge — shared dashboard logic
   Expects a JSON file at ../data/dashboard.json shaped like:
   {
     "generated_at": "ISO timestamp",
     "event": { "name": "", "start_date": "yyyy-mm-dd", "total_days": 100, "current_day": 42 },
     "summary": { "total_participants": 0, "total_points": 0, "active_today": 0, "latest_updates": [{text,time}] },
     "teams": [{ name, members, activity_points, bonus_points, total_points }],
     "participants": [{ name, team, activity_points, bonus_points, total_points, streak, sports_this_week: [], active_today }]
   }
   ============================================================ */

const DATA_URL = 'data/dashboard.json';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TEAM_PALETTE = [
  { name: 'coral', hex: '#E2542F' },
  { name: 'turf',  hex: '#2F7A4F' },
  { name: 'pool',  hex: '#2C6E9E' },
  { name: 'flag',  hex: '#F2A93B' },
  { name: 'purple',hex: '#6B4FA0' },
  { name: 'pink',  hex: '#C24B7C' },
];

function teamColor(teamName) {
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) hash = (hash * 31 + teamName.charCodeAt(i)) >>> 0;
  return TEAM_PALETTE[hash % TEAM_PALETTE.length].hex;
}

function formatNumber(n) {
  return Math.round(n).toLocaleString('en-IN');
}

function timeAgo(iso) {
  const then = new Date(iso).getTime();
  const diffMin = Math.round((Date.now() - then) / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return diffMin + 'm ago';
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return diffHr + 'h ago';
  return Math.round(diffHr / 24) + 'd ago';
}

function countUp(el, target, opts = {}) {
  const duration = REDUCED_MOTION ? 0 : (opts.duration || 1200);
  if (duration === 0) { el.textContent = formatNumber(target); return; }
  const start = performance.now();
  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = formatNumber(target * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function fillLaneBar(container, pct, opts = {}) {
  const fill = container.querySelector('.lane-fill');
  const target = Math.max(0, Math.min(100, pct));
  requestAnimationFrame(() => { fill.style.width = target + '%'; });
  if (opts.marker) {
    const marker = document.createElement('span');
    marker.className = 'lane-marker';
    marker.style.left = Math.max(6, Math.min(94, target)) + '%';
    marker.textContent = opts.marker;
    container.appendChild(marker);
  }
}

async function fetchDashboard() {
  const res = await fetch(DATA_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error('Could not load dashboard.json (' + res.status + ')');
  return res.json();
}

function renderSyncBadge(el, generatedAt) {
  if (!el) return;
  el.innerHTML = '<span class="sync-dot"></span> synced ' + timeAgo(generatedAt);
}

function markActiveNav(pageId) {
  document.querySelectorAll('.nav-links a').forEach(a => {
    a.classList.toggle('active', a.dataset.page === pageId);
  });
}

function computeTotals(participants) {
  return {
    activity: participants.reduce((s, p) => s + (p.activity_points || 0), 0),
    bonus: participants.reduce((s, p) => s + (p.bonus_points || 0), 0),
    total: participants.reduce((s, p) => s + (p.total_points || 0), 0),
  };
}
