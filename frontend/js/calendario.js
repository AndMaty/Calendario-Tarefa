const ViewCalendar = (() => {
  const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
  const MONTHS = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
  ];

  async function render() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="view-header calendar-header">
        <div>
          <h2>Calendário</h2>
          <p class="view-subtitle" id="calendar-range-label"></p>
        </div>
        <div class="calendar-controls">
          <div class="segmented" id="mode-switch">
            <button data-mode="day">Dia</button>
            <button data-mode="week">Semana</button>
            <button data-mode="month">Mês</button>
          </div>
          <div class="calendar-nav">
            <button class="icon-btn" id="nav-prev">‹</button>
            <button class="btn btn--ghost btn--small" id="nav-today">Hoje</button>
            <button class="icon-btn" id="nav-next">›</button>
          </div>
        </div>
      </div>
      <div id="calendar-body" class="calendar-body"></div>
      <div id="day-detail-modal" class="modal-backdrop hidden"></div>
    `;

    document.querySelectorAll("#mode-switch button").forEach((btn) => {
      btn.addEventListener("click", () => { STATE.calendarMode = btn.dataset.mode; renderBody(); });
    });
    document.getElementById("nav-prev").addEventListener("click", () => shift(-1));
    document.getElementById("nav-next").addEventListener("click", () => shift(1));
    document.getElementById("nav-today").addEventListener("click", () => {
      STATE.calendarRefDate = new Date();
      renderBody();
    });

    await renderBody();
  }

  function shift(direction) {
    const d = new Date(STATE.calendarRefDate);
    if (STATE.calendarMode === "day") d.setDate(d.getDate() + direction);
    else if (STATE.calendarMode === "week") d.setDate(d.getDate() + direction * 7);
    else d.setMonth(d.getMonth() + direction);
    STATE.calendarRefDate = d;
    renderBody();
  }

  async function renderBody() {
    document.querySelectorAll("#mode-switch button").forEach((btn) => {
      btn.classList.toggle("segmented__active", btn.dataset.mode === STATE.calendarMode);
    });

    const body = document.getElementById("calendar-body");
    body.innerHTML = `<p class="empty-hint">Carregando…</p>`;

    const ref = STATE.calendarRefDate;
    let start, end;
    if (STATE.calendarMode === "day") {
      start = end = new Date(ref);
    } else if (STATE.calendarMode === "week") {
      start = new Date(ref); start.setDate(ref.getDate() - ((ref.getDay() + 6) % 7));
      end = new Date(start); end.setDate(start.getDate() + 6);
    } else {
      start = new Date(ref.getFullYear(), ref.getMonth(), 1);
      end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
    }

    document.getElementById("calendar-range-label").textContent = rangeLabel(start, end);

    const [tasks, holidays] = await Promise.all([
      API.listTasks({ view: STATE.calendarMode, date: toISODate(ref) }).catch(() => []),
      loadHolidaysForRange(start, end),
    ]);

    const filtered = applyFilters(tasks);
    const holidayMap = Object.fromEntries(holidays.map((h) => [h.date, h.name]));

    if (STATE.calendarMode === "month") renderMonth(body, ref, filtered, holidayMap);
    else if (STATE.calendarMode === "week") renderWeek(body, start, filtered, holidayMap);
    else renderDay(body, ref, filtered, holidayMap);
  }

  async function loadHolidaysForRange(start, end) {
    const years = [...new Set([start.getFullYear(), end.getFullYear()])];
    const results = await Promise.all(
      years.map((y) => API.listHolidays(y).catch(() => []))
    );
    return results.flat();
  }

  function rangeLabel(start, end) {
    if (STATE.calendarMode === "day") {
      return start.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
    }
    if (STATE.calendarMode === "week") {
      return `${start.toLocaleDateString("pt-BR")} — ${end.toLocaleDateString("pt-BR")}`;
    }
    return `${MONTHS[STATE.calendarRefDate.getMonth()]} de ${STATE.calendarRefDate.getFullYear()}`;
  }

  function renderMonth(body, ref, tasks, holidayMap) {
    const year = ref.getFullYear(), month = ref.getMonth();
    const firstDay = new Date(year, month, 1);
    const gridStart = new Date(firstDay);
    gridStart.setDate(firstDay.getDate() - firstDay.getDay());

    const tasksByDate = groupByDate(tasks);
    const todayISO = toISODate(new Date());

    let cells = "";
    for (let i = 0; i < 42; i++) {
      const cellDate = new Date(gridStart);
      cellDate.setDate(gridStart.getDate() + i);
      const iso = toISODate(cellDate);
      const inMonth = cellDate.getMonth() === month;
      const isToday = iso === todayISO;
      const holidayName = holidayMap[iso];
      const dayTasks = tasksByDate[iso] || [];

      cells += `
        <div class="cal-cell ${inMonth ? "" : "cal-cell--muted"} ${isToday ? "cal-cell--today" : ""} ${holidayName ? "cal-cell--holiday" : ""}"
             data-date="${iso}">
          <div class="cal-cell__head">
            <span class="cal-cell__num">${cellDate.getDate()}</span>
            ${holidayName ? `<span class="cal-cell__holiday-badge" title="${escapeHtml(holidayName)}">🎉</span>` : ""}
          </div>
          ${holidayName ? `<div class="cal-cell__holiday-name">${escapeHtml(holidayName)}</div>` : ""}
          <div class="cal-cell__tasks">
            ${dayTasks.slice(0, 3).map((t) => `
              <div class="cal-task-pill" style="--status-color:${STATUS_META[t.status].color}" title="${escapeHtml(t.title)}">
                ${t.task_time.slice(0,5)} · ${escapeHtml(t.title)}
              </div>`).join("")}
            ${dayTasks.length > 3 ? `<div class="cal-task-more">+${dayTasks.length - 3} mais</div>` : ""}
          </div>
        </div>
      `;
    }

    body.innerHTML = `
      <div class="cal-grid cal-grid--month">
        ${WEEKDAYS.map((d) => `<div class="cal-weekday">${d}</div>`).join("")}
        ${cells}
      </div>
    `;
    wireCellClicks(tasksByDate, holidayMap);
  }

  function renderWeek(body, weekStart, tasks, holidayMap) {
    const tasksByDate = groupByDate(tasks);
    const todayISO = toISODate(new Date());
    let cols = "";
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart); d.setDate(weekStart.getDate() + i);
      const iso = toISODate(d);
      const holidayName = holidayMap[iso];
      const dayTasks = (tasksByDate[iso] || []).sort((a, b) => a.task_time.localeCompare(b.task_time));
      cols += `
        <div class="cal-col ${iso === todayISO ? "cal-col--today" : ""} ${holidayName ? "cal-cell--holiday" : ""}">
          <div class="cal-col__head">
            <strong>${WEEKDAYS[d.getDay()]}</strong> <span>${d.getDate()}</span>
            ${holidayName ? `<div class="cal-cell__holiday-name">🎉 ${escapeHtml(holidayName)}</div>` : ""}
          </div>
          <div class="cal-col__body">
            ${dayTasks.length ? dayTasks.map(renderAgendaItem).join("") : `<p class="empty-hint">Sem tarefas</p>`}
          </div>
        </div>
      `;
    }
    body.innerHTML = `<div class="cal-grid cal-grid--week">${cols}</div>`;
    wireAgendaActions();
  }

  function renderDay(body, ref, tasks, holidayMap) {
    const iso = toISODate(ref);
    const holidayName = holidayMap[iso];
    const dayTasks = tasks.filter((t) => t.task_date === iso).sort((a, b) => a.task_time.localeCompare(b.task_time));
    body.innerHTML = `
      <div class="cal-day-view">
        ${holidayName ? `<div class="holiday-banner">🎉 Feriado: ${escapeHtml(holidayName)}</div>` : ""}
        ${dayTasks.length ? dayTasks.map(renderAgendaItem).join("") : `<p class="empty-hint">Nenhuma tarefa para este dia.</p>`}
      </div>
    `;
    wireAgendaActions();
  }

  function renderAgendaItem(task) {
    const meta = STATUS_META[task.status];
    return `
      <div class="agenda-item" style="--status-color:${meta.color}" data-task-id="${task.id}">
        <div class="agenda-item__time">${task.task_time.slice(0,5)}</div>
        <div class="agenda-item__main">
          <strong>${meta.emoji} ${escapeHtml(task.title)}</strong>
          <span class="agenda-item__duration">${formatDuration(task.duration_minutes)}</span>
          ${task.tags.length ? `<div class="task-card__tags">${task.tags.map((t) => `<span class="tag-chip" style="--tag-color:${t.color}">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
        </div>
      </div>
    `;
  }

  function wireAgendaActions() {
    document.querySelectorAll(".agenda-item").forEach((el) => {
      el.addEventListener("click", () => navigateTo("#/tasks"));
    });
  }

  function wireCellClicks(tasksByDate) {
    document.querySelectorAll(".cal-cell").forEach((cell) => {
      cell.addEventListener("click", () => {
        STATE.calendarRefDate = new Date(cell.dataset.date + "T00:00:00");
        STATE.calendarMode = "day";
        renderBody();
        document.querySelectorAll("#mode-switch button").forEach((btn) => {
          btn.classList.toggle("segmented__active", btn.dataset.mode === "day");
        });
      });
    });
  }

  function groupByDate(tasks) {
    const map = {};
    tasks.forEach((t) => { (map[t.task_date] ||= []).push(t); });
    return map;
  }

  return { render };
})();