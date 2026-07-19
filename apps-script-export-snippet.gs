/**
 * ============================================================
 * ADD THIS TO YOUR DASHBOARD WORKBOOK'S APPS SCRIPT
 * (the same project that already has syncDashboardData,
 *  calculateBonuses, buildLeaderboard, etc.)
 * ============================================================
 * 1. Deploy this project as a Web App (Deploy → New deployment →
 *    Web app). Set "Who has access" to "Anyone".
 * 2. Copy the deployment URL — you'll paste it into the
 *    GitHub Action secret DASHBOARD_WEBAPP_URL.
 * 3. GitHub Action calls this URL every 15 min and commits the
 *    JSON response to data/dashboard.json in your repo.
 * ============================================================
 */

// If a doGet(e) already exists in this project (it should, from
// the daily-log Web App), ADD this branch at the top of it:
//
//   if (e.parameter.action === "dashboardJson") {
//     return getDashboardJson();
//   }
//
// If there is no doGet(e) yet in THIS project, use the function
// below as-is.

function doGet(e) {
  if (e.parameter.action === "dashboardJson") {
    return getDashboardJson();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ status: "Dashboard export API running" }))
    .setMimeType(ContentService.MimeType.JSON);
}

// EVENT_START_DATE / EVENT_TOTAL_DAYS — set these once for your challenge
const EVENT_NAME       = "SRC 100 Day Challenge";
const EVENT_START_DATE = "2026-06-08"; // yyyy-mm-dd
const EVENT_TOTAL_DAYS = 100;

function getDashboardJson() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet  = ss.getSheetByName("Dashboard Data");
  const bonusSheet = ss.getSheetByName("Bonus Log");

  const activity = dataSheet ? dataSheet.getDataRange().getValues() : [];
  const bonuses  = bonusSheet ? bonusSheet.getDataRange().getValues() : [];

  const individual = {}; // name -> { team, activityPts, bonusPts, streak dates, sportsThisWeek }
  const teamTotals = {}; // team -> { members:Set, activity, bonus, total }

  const today = new Date();
  const weekStart = getWeekStart(today);
  const activeToday = new Set();
  const todayStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");

  for (let i = 1; i < activity.length; i++) {
    const name    = String(activity[i][1] || "").trim();
    const team    = String(activity[i][2] || "").trim();
    const actDate = activity[i][3];
    const actType = String(activity[i][4] || "").trim();
    const pts     = parseFloat(activity[i][10]) || 0;
    if (!name || !actDate) continue;

    const d = (actDate instanceof Date) ? actDate : new Date(actDate);
    const dateStr = Utilities.formatDate(d, Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (dateStr === todayStr) activeToday.add(name);

    if (!individual[name]) individual[name] = { team, activityPts: 0, bonusPts: 0, dates: new Set(), sportsThisWeek: new Set() };
    individual[name].activityPts += pts;
    individual[name].dates.add(dateStr);
    if (d >= weekStart) individual[name].sportsThisWeek.add(actType);

    if (!teamTotals[team]) teamTotals[team] = { members: new Set(), activity: 0, bonus: 0 };
    teamTotals[team].members.add(name);
    teamTotals[team].activity += pts;
  }

  for (let i = 1; i < bonuses.length; i++) {
    const name = String(bonuses[i][1] || "").trim();
    const team = String(bonuses[i][2] || "").trim();
    const pts  = parseFloat(bonuses[i][4]) || 0;
    if (name === "(Team Bonus)") {
      if (!teamTotals[team]) teamTotals[team] = { members: new Set(), activity: 0, bonus: 0 };
      teamTotals[team].bonus += pts;
      continue;
    }
    if (!individual[name]) individual[name] = { team, activityPts: 0, bonusPts: 0, dates: new Set(), sportsThisWeek: new Set() };
    individual[name].bonusPts += pts;
    if (!teamTotals[team]) teamTotals[team] = { members: new Set(), activity: 0, bonus: 0 };
    teamTotals[team].bonus += pts;
  }

  const participants = Object.keys(individual).map(name => {
    const r = individual[name];
    return {
      name: name,
      team: r.team,
      activity_points: Math.round(r.activityPts),
      bonus_points: Math.round(r.bonusPts),
      total_points: Math.round(r.activityPts + r.bonusPts),
      streak: computeStreakForExport(r.dates, today),
      sports_this_week: Array.from(r.sportsThisWeek),
      active_today: activeToday.has(name),
    };
  });

  const teams = Object.keys(teamTotals).map(team => {
    const t = teamTotals[team];
    return {
      name: team,
      members: t.members.size,
      activity_points: Math.round(t.activity),
      bonus_points: Math.round(t.bonus),
      total_points: Math.round(t.activity + t.bonus),
    };
  });

  const startDate = new Date(EVENT_START_DATE);
  const currentDay = Math.max(1, Math.min(EVENT_TOTAL_DAYS,
    Math.floor((today - startDate) / (1000 * 60 * 60 * 24)) + 1));

  const recentBonuses = bonuses.slice(1).slice(-10).reverse().map(row => ({
    text: `${row[1]} — ${row[3]} +${row[4]} pts`,
    time: (row[0] instanceof Date ? row[0] : new Date(row[0])).toISOString(),
  }));

  const payload = {
    generated_at: today.toISOString(),
    event: {
      name: EVENT_NAME,
      start_date: EVENT_START_DATE,
      total_days: EVENT_TOTAL_DAYS,
      current_day: currentDay,
    },
    summary: {
      total_participants: participants.length,
      total_points: participants.reduce((s, p) => s + p.total_points, 0),
      active_today: activeToday.size,
      latest_updates: recentBonuses,
    },
    teams: teams,
    participants: participants,
  };

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function computeStreakForExport(dateSet, asOfDate) {
  let cursor = new Date(asOfDate);
  cursor.setHours(0, 0, 0, 0);
  let d = Utilities.formatDate(cursor, Session.getScriptTimeZone(), "yyyy-MM-dd");
  if (!dateSet.has(d)) {
    cursor.setDate(cursor.getDate() - 1);
    d = Utilities.formatDate(cursor, Session.getScriptTimeZone(), "yyyy-MM-dd");
    if (!dateSet.has(d)) return 0;
  }
  let streak = 0;
  while (dateSet.has(Utilities.formatDate(cursor, Session.getScriptTimeZone(), "yyyy-MM-dd"))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function getWeekStart(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}
