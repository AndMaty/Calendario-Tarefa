const ViewDashboard = (() => {
  async function render() {
    const content = document.getElementById("content");
    content.innerHTML = `
      <div class="view-header">
        <h2>Dashboard</h2>
        <p class="view-subtitle">Uma visão geral da sua produtividade.</p>
      </div>
      <div id="dashboard-body" class="dashboard-grid">
        <p class="empty-hint">Carregando estatísticas…</p>
      </div>
    `;

    try {
      const stats = await API.dashboardStats();
      draw(stats);
    } catch (err) {
      document.getElementById("dashboard-body").innerHTML =
        `<p class="empty-hint empty-hint--error">${escapeHtml(err.message)}</p>`;
    }
  }

  function draw(stats) {
    const body = document.getElementById("dashboard-body");
    body.innerHTML = `
      <div class="stat-cards">
        ${statCard("Total de tarefas", stats.total_tasks, "#1B2430")}
        ${statCard("Para Fazer", stats.by_status.todo, STATUS_META.todo.color)}
        ${statCard("Fazendo", stats.by_status.doing, STATUS_META.doing.color)}
        ${statCard("Concluídas", stats.by_status.done, STATUS_META.done.color)}
        ${statCard("Taxa de conclusão", `${stats.completion_rate}%`, "#2F6F63")}
      </div>

      <div class="card chart-card">
        <h3>Tarefas concluídas — últimos 30 dias</h3>
        ${lineChart(stats.completed_last_30_days)}
      </div>

      <div class="card chart-card">
        <h3>Distribuição por status</h3>
        ${statusBarChart(stats.by_status)}
      </div>

      <div class="card chart-card">
        <h3>Tags com mais tarefas concluídas</h3>
        ${stats.top_tags.length ? tagBarChart(stats.top_tags) : `<p class="empty-hint">Conclua tarefas com tags para ver este gráfico.</p>`}
      </div>
    `;
  }

  function statCard(label, value, color) {
    return `
      <div class="stat-card" style="--accent:${color}">
        <span class="stat-card__value">${value}</span>
        <span class="stat-card__label">${label}</span>
      </div>
    `;
  }

  function lineChart(series) {
    const width = 720, height = 220, padding = 32;
    const max = Math.max(1, ...series.map((s) => s.total));
    const stepX = (width - padding * 2) / (series.length - 1 || 1);

    const points = series.map((s, i) => {
      const x = padding + i * stepX;
      const y = height - padding - (s.total / max) * (height - padding * 2);
      return `${x},${y}`;
    });

    const linePath = `M ${points.join(" L ")}`;
    const areaPath = `M ${padding},${height - padding} L ${points.join(" L ")} L ${width - padding},${height - padding} Z`;

    const labelEvery = Math.ceil(series.length / 6);
    const labels = series.map((s, i) => {
      if (i % labelEvery !== 0) return "";
      const x = padding + i * stepX;
      const shortDate = s.date.slice(5).replace("-", "/");
      return `<text x="${x}" y="${height - 8}" class="chart-axis-label" text-anchor="middle">${shortDate}</text>`;
    }).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="chart-axis" />
        <path d="${areaPath}" class="chart-area" />
        <path d="${linePath}" class="chart-line" />
        ${labels}
      </svg>
    `;
  }

  function statusBarChart(byStatus) {
    const width = 720, height = 180, padding = 40;
    const entries = [
      ["todo", byStatus.todo], ["doing", byStatus.doing], ["done", byStatus.done],
    ];
    const max = Math.max(1, ...entries.map(([, v]) => v));
    const barWidth = 90;
    const gap = (width - padding * 2 - barWidth * 3) / 2;

    const bars = entries.map(([key, value], i) => {
      const barHeight = (value / max) * (height - padding * 2);
      const x = padding + i * (barWidth + gap);
      const y = height - padding - barHeight;
      const meta = STATUS_META[key];
      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="${meta.color}" rx="6"></rect>
        <text x="${x + barWidth / 2}" y="${height - padding + 18}" text-anchor="middle" class="chart-axis-label">${meta.label}</text>
        <text x="${x + barWidth / 2}" y="${y - 8}" text-anchor="middle" class="chart-value-label">${value}</text>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" class="chart-axis" />
        ${bars}
      </svg>
    `;
  }

  function tagBarChart(topTags) {
    const rowHeight = 34, width = 720, padding = 140;
    const height = rowHeight * topTags.length + 20;
    const max = Math.max(1, ...topTags.map((t) => t.total));

    const rows = topTags.map((tag, i) => {
      const barMaxWidth = width - padding - 40;
      const barWidth = (tag.total / max) * barMaxWidth;
      const y = i * rowHeight + 10;
      return `
        <text x="${padding - 10}" y="${y + 16}" text-anchor="end" class="chart-axis-label">${escapeHtml(tag.name)}</text>
        <rect x="${padding}" y="${y}" width="${barWidth}" height="20" fill="${tag.color}" rx="4"></rect>
        <text x="${padding + barWidth + 8}" y="${y + 16}" class="chart-value-label">${tag.total}</text>
      `;
    }).join("");

    return `
      <svg viewBox="0 0 ${width} ${height}" class="chart-svg" preserveAspectRatio="xMidYMid meet">
        ${rows}
      </svg>
    `;
  }

  return { render };
})();