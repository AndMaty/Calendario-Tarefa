const STATE = {
  user: null,
  tags: [],
  searchQuery: "",
  activeTagFilters: [],
  calendarRefDate: new Date(),
  calendarMode: "month",
};

const STATUS_META = {
  todo:  { label: "Para Fazer", color: "#D64545", emoji: "🔴" },
  doing: { label: "Fazendo",    color: "#E0A937", emoji: "🟡" },
  done:  { label: "Concluído",  color: "#2F9E52", emoji: "🟢" },
};

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str ?? "";
  return div.innerHTML;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function toISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function formatDateHuman(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h${pad2(m)}`;
  if (h) return `${h}h`;
  return `${m}min`;
}

function toast(message, type = "info") {
  const container = document.getElementById("toast-container");
  const el = document.createElement("div");
  el.className = `toast toast--${type}`;
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add("toast--visible"));
  setTimeout(() => {
    el.classList.remove("toast--visible");
    setTimeout(() => el.remove(), 250);
  }, 3200);
}

function applyFilters(tasks) {
  let result = tasks;
  if (STATE.searchQuery.trim()) {
    const q = STATE.searchQuery.trim().toLowerCase();
    result = result.filter((t) => t.title.toLowerCase().includes(q));
  }
  if (STATE.activeTagFilters.length) {
    result = result.filter((t) =>
      t.tags.some((tag) => STATE.activeTagFilters.includes(tag.id))
    );
  }
  return result;
}

const ROUTES = {
  "#/calendar": { render: () => ViewCalendar.render(), navKey: "calendar" },
  "#/tasks":    { render: () => ViewTasks.render(),    navKey: "tasks" },
  "#/kanban":   { render: () => ViewKanban.render(),   navKey: "kanban" },
  "#/dashboard":{ render: () => ViewDashboard.render(),navKey: "dashboard" },
};

async function router() {
  const isAuthed = !!API.getToken();
  const hash = window.location.hash || "#/calendar";

  if (!isAuthed && hash !== "#/login" && hash !== "#/register") {
    window.location.hash = "#/login";
    return;
  }
  if (isAuthed && (hash === "#/login" || hash === "#/register")) {
    window.location.hash = "#/calendar";
    return;
  }

  if (hash === "#/login") return ViewAuth.renderLogin();
  if (hash === "#/register") return ViewAuth.renderRegister();

  const route = ROUTES[hash] || ROUTES["#/calendar"];
  document.getElementById("app-shell").classList.remove("hidden");
  document.getElementById("auth-shell").classList.add("hidden");
  setActiveNav(route.navKey);

  if (!STATE.tags.length) {
    try { STATE.tags = await API.listTags(); } catch (_e) {}
  }

  route.render();
}

function setActiveNav(key) {
  document.querySelectorAll(".sidebar__icon").forEach((btn) => {
    btn.classList.toggle("sidebar__icon--active", btn.dataset.nav === key);
  });
}

function navigateTo(hash) {
  window.location.hash = hash;
}

function refreshUserChrome() {
  const user = API.getUser();
  STATE.user = user;
  const nameEl = document.getElementById("current-username");
  if (nameEl) nameEl.textContent = user ? user.username : "";
}

function mountShellChrome() {
  refreshUserChrome();

  document.getElementById("search-input").addEventListener("input", (e) => {
    STATE.searchQuery = e.target.value;
    const hash = window.location.hash || "#/calendar";
    const route = ROUTES[hash];
    if (route) route.render();
  });

  document.querySelectorAll(".sidebar__icon").forEach((btn) => {
    btn.addEventListener("click", () => navigateTo(`#/${btn.dataset.nav}`));
  });

  document.getElementById("logout-btn").addEventListener("click", () => {
    API.clearToken();
    STATE.user = null;
    STATE.tags = [];
    navigateTo("#/login");
    toast("Sessão encerrada.", "info");
  });
}

window.addEventListener("hashchange", router);
window.addEventListener("DOMContentLoaded", () => {
  mountShellChrome();
  router();
});