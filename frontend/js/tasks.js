const ViewTasks = (() => {
  let editingTaskId = null;

  async function render() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="view-header">
        <h2>Minhas Tarefas</h2>
        <p class="view-subtitle">Cadastre, edite e acompanhe suas tarefas em um só lugar.</p>
      </div>
      <div class="tasks-layout">
        <section class="card task-form-card">
          <h3 id="form-title">Nova tarefa</h3>
          <form id="task-form" class="task-form">
            <label>Título *
              <input type="text" name="title" required maxlength="120" placeholder="Ex: Reunião com o time" />
            </label>
            <label>Descrição
              <textarea name="description" rows="3" placeholder="Detalhes da tarefa (opcional)"></textarea>
            </label>
            <div class="task-form__row">
              <label>Data *
                <input type="date" name="task_date" required />
              </label>
              <label>Hora *
                <input type="time" name="task_time" required />
              </label>
            </div>
            <div class="task-form__row">
              <label>Duração (minutos) *
                <input type="number" name="duration_minutes" min="5" step="5" value="30" required />
              </label>
              <label>Status
                <select name="status">
                  <option value="todo">🔴 Para Fazer</option>
                  <option value="doing">🟡 Fazendo</option>
                  <option value="done">🟢 Concluído</option>
                </select>
              </label>
            </div>
            <div class="task-form__tags">
              <span class="task-form__tags-label">Tags</span>
              <div id="tag-checkboxes" class="tag-checkboxes"></div>
              <div class="tag-quick-add">
                <input type="text" id="new-tag-name" placeholder="Nova tag" maxlength="30" />
                <input type="color" id="new-tag-color" value="#2F6F63" />
                <button type="button" id="add-tag-btn" class="btn btn--ghost btn--small">+ Adicionar</button>
              </div>
            </div>
            <div class="task-form__actions">
              <button type="submit" class="btn btn--primary">Salvar tarefa</button>
              <button type="button" id="cancel-edit" class="btn btn--ghost hidden">Cancelar edição</button>
            </div>
          </form>
        </section>

        <section class="tasks-list-section">
          <div class="tag-filter-bar" id="tag-filter-bar"></div>
          <div id="tasks-groups"></div>
        </section>
      </div>
    `;

    renderTagCheckboxes();
    renderTagFilterBar();
    wireForm();
    await loadAndRenderTasks();
  }

  function renderTagCheckboxes() {
    const box = document.getElementById("tag-checkboxes");
    if (!STATE.tags.length) {
      box.innerHTML = `<span class="empty-hint">Nenhuma tag ainda — crie uma abaixo.</span>`;
      return;
    }
    box.innerHTML = STATE.tags.map((tag) => `
      <label class="tag-checkbox" style="--tag-color:${tag.color}">
        <input type="checkbox" value="${tag.id}" />
        <span>${escapeHtml(tag.name)}</span>
      </label>
    `).join("");
  }

  function renderTagFilterBar() {
    const bar = document.getElementById("tag-filter-bar");
    if (!STATE.tags.length) { bar.innerHTML = ""; return; }
    bar.innerHTML = `
      <span class="tag-filter-bar__label">Filtrar por tags:</span>
      ${STATE.tags.map((tag) => `
        <button type="button" class="tag-pill ${STATE.activeTagFilters.includes(tag.id) ? "tag-pill--active" : ""}"
                data-tag-id="${tag.id}" style="--tag-color:${tag.color}">
          ${escapeHtml(tag.name)} <span class="tag-pill__count">${tag.task_count ?? ""}</span>
          <button class="tag-pill__delete" data-delete-tag="${tag.id}" title="Remover tag">✕</button>
        </button>
      `).join("")}
    `;
    bar.querySelectorAll(".tag-pill").forEach((pill) => {
      pill.addEventListener("click", (e) => {
        if (e.target.closest("[data-delete-tag]")) return;
        const id = Number(pill.dataset.tagId);
        const idx = STATE.activeTagFilters.indexOf(id);
        if (idx === -1) STATE.activeTagFilters.push(id); else STATE.activeTagFilters.splice(idx, 1);
        render();
      });
    });
    bar.querySelectorAll("[data-delete-tag]").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = Number(btn.dataset.deleteTag);
        if (!confirm("Remover esta tag de todas as tarefas?")) return;
        try {
          await API.deleteTag(id);
          STATE.tags = STATE.tags.filter((t) => t.id !== id);
          STATE.activeTagFilters = STATE.activeTagFilters.filter((t) => t !== id);
          toast("Tag removida.", "success");
          render();
        } catch (err) { toast(err.message, "error"); }
      });
    });
  }

  function wireForm() {
    const form = document.getElementById("task-form");
    form.addEventListener("submit", onSubmit);
    document.getElementById("cancel-edit").addEventListener("click", resetForm);
    document.getElementById("add-tag-btn").addEventListener("click", onAddTag);
  }

  async function onAddTag() {
    const nameInput = document.getElementById("new-tag-name");
    const colorInput = document.getElementById("new-tag-color");
    const name = nameInput.value.trim();
    if (!name) { toast("Digite um nome para a tag.", "error"); return; }
    try {
      const tag = await API.createTag({ name, color: colorInput.value });
      STATE.tags.push(tag);
      nameInput.value = "";
      renderTagCheckboxes();
      renderTagFilterBar();
      toast("Tag criada.", "success");
    } catch (err) { toast(err.message, "error"); }
  }

  async function onSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const data = new FormData(form);
    const selectedTags = Array.from(
      form.querySelectorAll('#tag-checkboxes input[type="checkbox"]:checked')
    ).map((cb) => Number(cb.value));

    const payload = {
      title: data.get("title"),
      description: data.get("description"),
      task_date: data.get("task_date"),
      task_time: data.get("task_time"),
      duration_minutes: Number(data.get("duration_minutes")),
      status: data.get("status"),
      tags: selectedTags,
    };

    try {
      if (editingTaskId) {
        await API.updateTask(editingTaskId, payload);
        toast("Tarefa atualizada.", "success");
      } else {
        await API.createTask(payload);
        toast("Tarefa criada.", "success");
      }
      resetForm();
      await loadAndRenderTasks();
    } catch (err) { toast(err.message, "error"); }
  }

  function resetForm() {
    editingTaskId = null;
    document.getElementById("form-title").textContent = "Nova tarefa";
    document.getElementById("task-form").reset();
    document.getElementById("cancel-edit").classList.add("hidden");
    document.querySelectorAll('#tag-checkboxes input[type="checkbox"]').forEach((cb) => (cb.checked = false));
  }

  function fillFormForEdit(task) {
    editingTaskId = task.id;
    document.getElementById("form-title").textContent = `Editando: ${task.title}`;
    const form = document.getElementById("task-form");
    form.title.value = task.title;
    form.description.value = task.description || "";
    form.task_date.value = task.task_date;
    form.task_time.value = task.task_time;
    form.duration_minutes.value = task.duration_minutes;
    form.status.value = task.status;
    document.querySelectorAll('#tag-checkboxes input[type="checkbox"]').forEach((cb) => {
      cb.checked = task.tags.some((t) => t.id === Number(cb.value));
    });
    document.getElementById("cancel-edit").classList.remove("hidden");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function loadAndRenderTasks() {
    const groupsEl = document.getElementById("tasks-groups");
    groupsEl.innerHTML = `<p class="empty-hint">Carregando tarefas…</p>`;
    try {
      const tasks = applyFilters(await API.listTasks());
      const todayISO = toISODate(new Date());

      const overdue = tasks.filter((t) => t.task_date < todayISO && t.status !== "done");
      const today = tasks.filter((t) => t.task_date === todayISO);
      const upcoming = tasks.filter((t) => t.task_date > todayISO);
      const doneOld = tasks.filter((t) => t.task_date < todayISO && t.status === "done");

      groupsEl.innerHTML = [
        renderGroup("⏰ Atrasadas", overdue, "Nenhuma tarefa atrasada. Bom trabalho!"),
        renderGroup("📍 Hoje", today, "Nenhuma tarefa para hoje."),
        renderGroup("📆 Próximas", upcoming, "Nenhuma tarefa futura cadastrada."),
        renderGroup("✅ Concluídas (histórico)", doneOld, ""),
      ].join("");

      wireTaskCardActions();
    } catch (err) {
      groupsEl.innerHTML = `<p class="empty-hint empty-hint--error">${escapeHtml(err.message)}</p>`;
    }
  }

  function renderGroup(title, tasks, emptyMsg) {
    if (!tasks.length && !emptyMsg) return "";
    return `
      <div class="task-group">
        <h4 class="task-group__title">${title} <span class="task-group__count">${tasks.length}</span></h4>
        ${tasks.length
          ? `<div class="task-list">${tasks.map(renderTaskCard).join("")}</div>`
          : `<p class="empty-hint">${emptyMsg}</p>`}
      </div>
    `;
  }

  function renderTaskCard(task) {
    const meta = STATUS_META[task.status];
    return `
      <article class="task-card" style="--status-color:${meta.color}" data-task-id="${task.id}">
        <div class="task-card__status" title="${meta.label}">${meta.emoji}</div>
        <div class="task-card__body">
          <h5>${escapeHtml(task.title)}</h5>
          ${task.description ? `<p class="task-card__desc">${escapeHtml(task.description)}</p>` : ""}
          <div class="task-card__meta">
            <span>${formatDateHuman(task.task_date)}</span>
            <span>${task.task_time}</span>
            <span>${formatDuration(task.duration_minutes)}</span>
          </div>
          ${task.tags.length ? `<div class="task-card__tags">
            ${task.tags.map((t) => `<span class="tag-chip" style="--tag-color:${t.color}">${escapeHtml(t.name)}</span>`).join("")}
          </div>` : ""}
        </div>
        <div class="task-card__actions">
          <button class="icon-btn" data-edit="${task.id}" title="Editar">✏️</button>
          <button class="icon-btn" data-delete="${task.id}" title="Excluir">🗑️</button>
        </div>
      </article>
    `;
  }

  function wireTaskCardActions() {
    document.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const task = await API.getTask(Number(btn.dataset.edit));
        fillFormForEdit(task);
      });
    });
    document.querySelectorAll("[data-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Excluir esta tarefa permanentemente?")) return;
        try {
          await API.deleteTask(Number(btn.dataset.delete));
          toast("Tarefa excluída.", "success");
          await loadAndRenderTasks();
        } catch (err) { toast(err.message, "error"); }
      });
    });
  }

  return { render };
})();