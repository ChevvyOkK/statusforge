const REPO = "ChevvyOkK/statusforge";
const BRANCH = "master";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${BRANCH}`;
const REFRESH_MS = 60000;
const SPARKLINE_POINTS = 40;

const grid = document.getElementById("service-grid");
const lastUpdatedEl = document.getElementById("last-updated");
const noteEl = document.getElementById("note");

async function fetchJson(path) {
  const res = await fetch(`${RAW_BASE}/${path}?t=${Date.now()}`);
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
}

function statusBadge(status) {
  const labels = { up: "Работает", degraded: "Проблемы", down: "Недоступен", unknown: "Нет данных" };
  return `<span class="badge badge-${status}">${labels[status] ?? labels.unknown}</span>`;
}

function uptimePercent(entries) {
  if (entries.length === 0) return null;
  const upCount = entries.filter((e) => e.status === "up").length;
  return ((upCount / entries.length) * 100).toFixed(1);
}

function renderSparkline(entries) {
  const recent = entries.slice(-SPARKLINE_POINTS);
  if (recent.length === 0) return '<div class="sparkline"></div>';
  const maxLatency = Math.max(...recent.map((e) => e.latencyMs), 1);
  const bars = recent
    .map((e) => {
      const heightPct = e.status === "down" ? 100 : Math.max(15, (e.latencyMs / maxLatency) * 100);
      return `<div class="bar bar-${e.status}" style="height:${heightPct}%" title="${e.t}: ${e.status}, ${e.latencyMs}ms"></div>`;
    })
    .join("");
  return `<div class="sparkline">${bars}</div>`;
}

function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин назад`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ч назад`;
  return `${Math.round(hours / 24)} дн назад`;
}

function renderCard(service, entries) {
  const latest = entries[entries.length - 1];
  const status = latest ? latest.status : "unknown";
  const uptime = uptimePercent(entries);

  return `
    <div class="card">
      <div class="card-top">
        <span class="card-name"><a href="${service.project}" target="_blank" rel="noopener noreferrer">${service.name}</a></span>
        ${statusBadge(status)}
      </div>
      <div class="card-stats">
        <div>
          <strong>${latest ? `${latest.latencyMs} мс` : "—"}</strong>
          задержка
        </div>
        <div>
          <strong>${uptime !== null ? `${uptime}%` : "—"}</strong>
          аптайм
        </div>
        <div>
          <strong>${entries.length}</strong>
          записей
        </div>
      </div>
      ${renderSparkline(entries)}
    </div>
  `;
}

async function render() {
  try {
    const [services, history] = await Promise.all([
      fetchJson("services.json"),
      fetchJson("data/history.json"),
    ]);

    grid.innerHTML = services.map((s) => renderCard(s, history[s.id] ?? [])).join("");

    const allTimestamps = Object.values(history)
      .flat()
      .map((e) => e.t)
      .sort();
    const latestTimestamp = allTimestamps[allTimestamps.length - 1];

    lastUpdatedEl.textContent = latestTimestamp
      ? `Обновлено: ${formatRelativeTime(latestTimestamp)}`
      : "Пока нет данных";

    const minEntries = Math.min(...services.map((s) => (history[s.id] ?? []).length));
    if (minEntries < 6) {
      noteEl.textContent =
        "История только начала накапливаться — часть графиков и процент аптайма появятся через несколько циклов проверки.";
    } else {
      noteEl.textContent = "";
    }
  } catch (err) {
    grid.innerHTML = `<p style="color:#f87171">Не удалось загрузить данные: ${err.message}</p>`;
  }
}

render();
setInterval(render, REFRESH_MS);
