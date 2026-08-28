/* ============================================================
   SRC 100 Day Challenge — shared dashboard logic
   Fetches live data from a Google Apps Script web app endpoint.
   
   HOW TO CONNECT:
   1. Deploy the Apps Script as a web app (Anyone access)
   2. Paste the deployment URL below as WEBAPP_URL
   ============================================================ */

// ⬇️ DEPLOYED APPS SCRIPT WEB APP URL ⬇️
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxrhD8vU7Y-9FEKj8a-NHzrcbiS5FxF67BVtMzbtV4_x4M5Hx5Ybj8mtmTNuM3PRxlM/exec';

// Fallback to local JSON if no webapp URL is set (for local dev/testing)
const DATA_URL = WEBAPP_URL || 'dashboard.json';
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Number formatting locale — centralised so it's easy to reuse the dashboard
// for a non-Indian audience later.
const NUMBER_LOCALE = 'en-IN';
const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TEAM_PALETTE = [
  { name: 'coral', hex: '#E2542F' },
  { name: 'turf',  hex: '#2F7A4F' },
  { name: 'pool',  hex: '#2C6E9E' },
  { name: 'flag',  hex: '#F2A93B' },
  { name: 'purple',hex: '#6B4FA0' },
  { name: 'pink',  hex: '#C24B7C' },
];

// Shared sport color palette — single source of truth for all charts.
// First 5 map 1:1 to the stacked bar segments; remaining are for donut overflow.
const SPORT_COLORS = [
  '#F97316', // orange
  '#10B981', // emerald
  '#3B82F6', // blue
  '#FBBF24', // amber
  '#6B4FA0', // violet
  '#C24B7C', // pink
  '#047857', // green-700
  '#EA580C', // orange-600
  '#2563EB', // blue-600
  '#D97706', // amber-600
];

const SPORT_MIX_COLORS = SPORT_COLORS.slice(0, 5); // exactly 5 for stacked bar top sports
const OTHER_COLOR = '#9CA3AF';
const BONUS_COLOR = '#111827';

const TEAM_COLORS = {
  'Dark Knight':     '#FF6B6B',  // soft red
  'Trailblazers':   '#51CF66',  // mint green
  'Mavericks':      '#339AF0',  // sky blue
  'Avengers':       '#CC5DE8',  // lavender purple
  'ApexForce':      '#FCC419',  // golden yellow
  'Flying Gazelle': '#22B8CF',  // teal
  'Dhurandhar':     '#FF922B',  // tangerine
  'Not Assigned':   '#888888',  // grey
  'Unassigned':     '#AAAAAA',  // light grey
};

function teamColor(teamName) {
  if (TEAM_COLORS[teamName]) return TEAM_COLORS[teamName];
  // fallback for any new teams not yet mapped
  let hash = 0;
  for (let i = 0; i < teamName.length; i++) hash = (hash * 31 + teamName.charCodeAt(i)) >>> 0;
  return TEAM_PALETTE[hash % TEAM_PALETTE.length].hex;
}

function formatNumber(n) {
  return Math.round(n).toLocaleString(NUMBER_LOCALE);
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

// Returns today's date as "YYYY-MM-DD" in IST (UTC+5:30), independent of the
// viewer's local timezone. Used to filter daily_breakdown by "today".
function todayIST() {
  const now = new Date();
  const istMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 60 * 60 * 1000);
  const ist = new Date(istMs);
  return ist.getFullYear() + '-' +
    String(ist.getMonth() + 1).padStart(2, '0') + '-' +
    String(ist.getDate()).padStart(2, '0');
}

// Returns "YYYY-MM-DD" for a Date, using LOCAL date components.
// Avoids the UTC offset shift that toISOString().slice(0,10) causes.
function localDateStr(d) {
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0');
}

// Returns a Date object representing the current instant expressed in IST
// (UTC+5:30). Used by countdowns that compare against IST-parsed dates.
function nowIST() {
  const now = new Date();
  const istMs = now.getTime() + (now.getTimezoneOffset() * 60000) + (5.5 * 60 * 60 * 1000);
  return new Date(istMs);
}

// Returns a Date set to local midnight N days ago, used for "last X days" windows.
function daysAgoLocal(n) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d;
}

function countUp(el, target, opts = {}) {
  const duration = prefersReducedMotion() ? 0 : (opts.duration || 1200);
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

const CACHE_KEY = 'src100_dashboard_cache';
const CACHE_MAX_AGE = 5 * 60 * 1000; // consider cache fresh for 5 minutes

function showLoadingToast() {
  const el = document.getElementById('loadingToast');
  if (el) el.classList.remove('hidden');
}

function hideLoadingToast() {
  const el = document.getElementById('loadingToast');
  if (el) el.classList.add('hidden');
}

async function fetchDashboard() {
  const cached = getCachedData();

  showLoadingToast();

  const freshPromise = fetch(DATA_URL, { cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('Could not load data (' + res.status + ')');
      return res.json();
    })
    .then(data => {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
      } catch (e) { /* quota exceeded, ignore */ }
      hideLoadingToast();
      return data;
    })
    .catch(err => {
      hideLoadingToast();
      throw err;
    });

  // If we have cached data, return it immediately but also trigger a background refresh
  if (cached) {
    freshPromise.then(freshData => {
      window.dispatchEvent(new CustomEvent('dashboardFreshData', { detail: freshData }));
    }).catch(() => {});
    return cached;
  }

  // No cache — wait for the network
  return freshPromise;
}

function getCachedData() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (data && ts) return data;
  } catch (e) { /* corrupted cache */ }
  return null;
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
