const ViewKanban = (() => {
  const COLUMNS = [
    { key: "todo", label: "🔴 Para Fazer" },
    { key: "doing", label: "🟡 Fazendo" },
    { key: "done", label: "🟢 Concluído" },
  ];

  let tasksCache = [];

  async function render() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="view-header">
        <h2>Kanban</h2>
        <p class="view-subtitle">Arraste os cartões entre as colunas para atualizar o status.</p>
      </div>
      <div class="kanban-board" id="kanban-board"></div>
    `;
    await loadAndRender();
  }

  async function loadAndRender() {
    const board = document.getElementById("kanban-board");
    board.innerHTML = `<p class="empty-hint">Carregando…</p>`;
    try {
      tasksCache = applyFilters(await API.listTasks());
      drawBoard();
    } catch (err) {
      board.innerHTML = `<p class="empty-hint empty-hint--error">${escapeHtml(err.message)}</p>`;
    }
  }

  function drawBoard() {
    const board = document.getElementById("kanban-board");
    board.innerHTML = COLUMNS.map((col) => {
      const items = tasksCache.filter((t) => t.status === col.key)
        .sort((a, b) => (a.task_date + a.task_time).localeCompare(b.task_date + b.task_time));
      return `
        <div class="kanban-column" data-status="${col.key}">
          <div class="kanban-column__head">
            <span>${col.label}</span>
            <span class="kanban-column__count">${items.length}</span>
          </div>
          <div class="kanban-column__body" data-dropzone="${col.key}">
            ${items.map(renderCard).join("") || `<p class="empty-hint">Arraste tarefas para cá</p>`}
          </div>
        </div>
      `;
    }).join("");

    wireDragAndDrop();
  }

  function renderCard(task) {
    return `
      <div class="kanban-card" draggable="true" data-task-id="${task.id}" style="--status-color:${STATUS_META[task.status].color}">
        <strong>${escapeHtml(task.title)}</strong>
        <div class="kanban-card__meta">
          <span>${formatDateHuman(task.task_date)}</span>
          <span>${task.task_time.slice(0,5)}</span>
        </div>
        ${task.tags.length ? `<div class="task-card__tags">${task.tags.map((t) => `<span class="tag-chip" style="--tag-color:${t.color}">${escapeHtml(t.name)}</span>`).join("")}</div>` : ""}
      </div>
    `;
  }

  function wireDragAndDrop() {
    document.querySelectorAll(".kanban-card").forEach((card) => {
      card.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", card.dataset.taskId);
        card.classList.add("kanban-card--dragging");
      });
      card.addEventListener("dragend", () => card.classList.remove("kanban-card--dragging"));
    });

    document.querySelectorAll(".kanban-column__body").forEach((zone) => {
      zone.addEventListener("dragover", (e) => {
        e.preventDefault();
        zone.classList.add("kanban-column__body--over");
      });
      zone.addEventListener("dragleave", () => zone.classList.remove("kanban-column__body--over"));
      zone.addEventListener("drop", async (e) => {
        e.preventDefault();
        zone.classList.remove("kanban-column__body--over");
        const taskId = Number(e.dataTransfer.getData("text/plain"));
        const newStatus = zone.dataset.dropzone;
        const task = tasksCache.find((t) => t.id === taskId);
        if (!task || task.status === newStatus) return;

        const previousStatus = task.status;
        task.status = newStatus; 
        drawBoard();

        try {
          await API.updateTaskStatus(taskId, newStatus);
          toast("Status atualizado.", "success");
        } catch (err) {
          task.status = previousStatus; 
          drawBoard();
          toast(err.message, "error");
        }
      });
    });
  }

  return { render };
})();
