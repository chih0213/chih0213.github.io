// Blog 上線日期：今天 00:00（本地時間）
const BLOG_START = (() => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
})();

function pad2(n) {
  return String(n).padStart(2, "0");
}

function getUptimeParts() {
  const diffMs = Math.max(0, Date.now() - BLOG_START.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds };
}

function renderUptimeHtml({ days, hours, minutes, seconds }) {
  const dayPart =
    days > 0
      ? `<span class="uptime-unit"><span class="uptime-num">${days}</span><span class="uptime-label">天</span></span>`
      : "";

  return `${dayPart}<span class="uptime-unit"><span class="uptime-num">${pad2(hours)}</span><span class="uptime-label">時</span></span><span class="uptime-sep">:</span><span class="uptime-unit"><span class="uptime-num">${pad2(minutes)}</span><span class="uptime-label">分</span></span><span class="uptime-sep">:</span><span class="uptime-unit uptime-seconds"><span class="uptime-num" id="uptime-seconds">${pad2(seconds)}</span><span class="uptime-label">秒</span></span>`;
}

let lastSnapshot = "";

function updateBlogUptime() {
  const uptimeEl = document.querySelector("#uptime-value");
  if (!uptimeEl) return;

  const parts = getUptimeParts();
  const snapshot = `${parts.days}-${parts.hours}-${parts.minutes}-${parts.seconds}`;

  if (snapshot === lastSnapshot) return;

  const prevParts = lastSnapshot.split("-").map(Number);
  const onlySecondsChanged =
    lastSnapshot &&
    prevParts[0] === parts.days &&
    prevParts[1] === parts.hours &&
    prevParts[2] === parts.minutes;

  if (onlySecondsChanged) {
    const secondsEl = document.querySelector("#uptime-seconds");
    if (secondsEl) {
      secondsEl.textContent = pad2(parts.seconds);
      secondsEl.classList.remove("is-ticking");
      void secondsEl.offsetWidth;
      secondsEl.classList.add("is-ticking");
    }
  } else {
    uptimeEl.innerHTML = renderUptimeHtml(parts);
  }

  lastSnapshot = snapshot;
}

updateBlogUptime();
window.setInterval(updateBlogUptime, 1000);

const canvas = document.querySelector("#signal-canvas");
const ctx = canvas.getContext("2d");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const weatherStatus = document.querySelector("#weather-status");
let points = [];
let rainDrops = [];
let clickParticles = [];
let weather = "cloudy";
let taipeiPeriod = "day";

const weatherLabels = { sunny: "晴天", cloudy: "陰天", rain: "下雨" };

function getTaipeiPeriod() {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei", hour: "2-digit", hourCycle: "h23",
  }).format(new Date()));
  if (hour >= 5 && hour < 8) return "morning";
  if (hour >= 8 && hour < 17) return "day";
  if (hour >= 17 && hour < 19) return "evening";
  return "night";
}

function setWeather(nextWeather, source = "live") {
  weather = nextWeather;
  taipeiPeriod = getTaipeiPeriod();
  document.body.dataset.weather = weather;
  document.body.dataset.time = taipeiPeriod;
  if (weatherStatus) {
    const timeLabel = { morning: "早上", day: "白天", evening: "傍晚", night: "夜晚" }[taipeiPeriod];
    weatherStatus.textContent = `Taipei · ${weatherLabels[weather]} · ${timeLabel}${source === "local" ? "（時間模式）" : ""}`;
  }
}

function weatherFromCode(code) {
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code)) return "rain";
  if ([1, 2, 3, 45, 48].includes(code)) return "cloudy";
  return "sunny";
}

async function refreshTaipeiWeather() {
  setWeather(weather, "local");
  try {
    const response = await fetch("https://api.open-meteo.com/v1/forecast?latitude=25.0330&longitude=121.5654&current=weather_code&timezone=Asia%2FTaipei", { cache: "no-store" });
    if (!response.ok) throw new Error("Weather request failed");
    const data = await response.json();
    setWeather(weatherFromCode(data.current.weather_code));
  } catch (error) {
    // Local Taipei time still provides the correct day/night background offline.
  }
}

function resizeCanvas() {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * ratio);
  canvas.height = Math.floor(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  points = Array.from({ length: Math.max(18, Math.floor(window.innerWidth / 58)) }, () => ({ x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight, vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35 }));
  rainDrops = Array.from({ length: Math.max(80, Math.floor(window.innerWidth / 9)) }, () => ({
    x: Math.random() * window.innerWidth,
    y: Math.random() * window.innerHeight,
    speed: 8 + Math.random() * 13,
    length: 10 + Math.random() * 22,
    width: 0.6 + Math.random() * 1.2,
    foreground: Math.random() > 0.88,
  }));
}

function drawOrb() {
  const x = window.innerWidth * 0.82;
  const y = window.innerHeight * 0.18;
  const radius = Math.min(68, window.innerWidth * 0.09);
  if (taipeiPeriod === "night") {
    ctx.fillStyle = "rgba(220, 232, 255, 0.62)";
    ctx.beginPath(); ctx.arc(x, y, radius * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "rgba(8, 20, 36, 0.92)";
    ctx.beginPath(); ctx.arc(x + radius * 0.25, y - radius * 0.13, radius * 0.58, 0, Math.PI * 2); ctx.fill();
    return;
  }
  const colors = taipeiPeriod === "evening" ? ["255, 155, 102", "255, 90, 100"] : ["255, 226, 145", "255, 184, 84"];
  const glow = ctx.createRadialGradient(x, y, 0, x, y, radius * 3.8);
  glow.addColorStop(0, `rgba(${colors[0]}, .45)`); glow.addColorStop(0.2, `rgba(${colors[1]}, .16)`); glow.addColorStop(1, "rgba(255, 190, 90, 0)");
  ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, radius * 2.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = `rgba(${colors[1]}, .82)`; ctx.beginPath(); ctx.arc(x, y, radius * 0.55, 0, Math.PI * 2); ctx.fill();
}

function drawClouds() {
  const drift = (Date.now() / 65) % (window.innerWidth + 280);
  for (const [offset, y, scale, alpha] of [[0, 0.18, 1.1, 0.35], [340, 0.36, 0.78, 0.24], [740, 0.08, 0.63, 0.2]]) {
    const x = (window.innerWidth - drift * scale + offset) % (window.innerWidth + 280) - 140;
    const cloudLight = ctx.createLinearGradient(x, window.innerHeight * y - 55 * scale, x, window.innerHeight * y + 55 * scale);
    cloudLight.addColorStop(0, `rgba(224, 237, 248, ${alpha})`);
    cloudLight.addColorStop(0.56, `rgba(157, 184, 208, ${alpha * 0.92})`);
    cloudLight.addColorStop(1, `rgba(55, 79, 112, ${alpha * 0.75})`);
    ctx.fillStyle = cloudLight;
    ctx.shadowColor = "rgba(0, 9, 25, 0.28)";
    ctx.shadowBlur = 20 * scale;
    ctx.shadowOffsetY = 10 * scale;
    ctx.beginPath();
    ctx.arc(x, window.innerHeight * y, 38 * scale, 0, Math.PI * 2);
    ctx.arc(x + 47 * scale, window.innerHeight * y - 18 * scale, 53 * scale, 0, Math.PI * 2);
    ctx.arc(x + 104 * scale, window.innerHeight * y, 35 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
  }
}

function drawRain() {
  for (const drop of rainDrops) {
    drop.y += drop.speed;
    drop.x -= drop.speed * 0.18;
    if (drop.y > window.innerHeight + drop.length) {
      drop.y = -drop.length;
      drop.x = Math.random() * window.innerWidth;
    }
    const streak = ctx.createLinearGradient(drop.x, drop.y, drop.x - drop.length * 0.22, drop.y + drop.length);
    streak.addColorStop(0, "rgba(201, 230, 255, 0)");
    streak.addColorStop(0.45, drop.foreground ? "rgba(207, 235, 255, 0.8)" : "rgba(174, 216, 255, 0.48)");
    streak.addColorStop(1, "rgba(135, 191, 246, 0)");
    ctx.strokeStyle = streak;
    ctx.lineWidth = drop.width;
    ctx.beginPath();
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x - drop.length * 0.22, drop.y + drop.length);
    ctx.stroke();
    if (drop.foreground && drop.y > window.innerHeight * 0.72) {
      const reflection = ctx.createRadialGradient(drop.x, drop.y, 0, drop.x, drop.y, 16);
      reflection.addColorStop(0, "rgba(184, 223, 255, 0.18)");
      reflection.addColorStop(1, "rgba(184, 223, 255, 0)");
      ctx.fillStyle = reflection;
      ctx.beginPath(); ctx.ellipse(drop.x, drop.y, 17, 5, 0, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawAtmosphericLight() {
  const horizon = window.innerHeight * 0.83;
  const wash = ctx.createLinearGradient(0, horizon - 180, 0, window.innerHeight);
  if (weather === "rain") {
    wash.addColorStop(0, "rgba(55, 106, 164, 0)");
    wash.addColorStop(1, "rgba(77, 139, 205, 0.22)");
  } else if (taipeiPeriod === "evening") {
    wash.addColorStop(0, "rgba(242, 104, 75, 0)");
    wash.addColorStop(1, "rgba(232, 103, 73, 0.16)");
  } else {
    wash.addColorStop(0, "rgba(115, 178, 237, 0)");
    wash.addColorStop(1, "rgba(117, 180, 231, 0.09)");
  }
  ctx.fillStyle = wash;
  ctx.fillRect(0, horizon - 180, window.innerWidth, window.innerHeight - horizon + 180);
}

function drawSignal() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  drawOrb();
  if (weather !== "sunny") drawClouds();
  if (weather === "rain") drawRain();
  drawAtmosphericLight();
  for (const point of points) {
    point.x += point.vx; point.y += point.vy;
    if (point.x < -20) point.x = window.innerWidth + 20;
    if (point.x > window.innerWidth + 20) point.x = -20;
    if (point.y < -20) point.y = window.innerHeight + 20;
    if (point.y > window.innerHeight + 20) point.y = -20;
  }
  for (let i = 0; i < points.length; i += 1) for (let j = i + 1; j < points.length; j += 1) {
    const a = points[i]; const b = points[j]; const distance = Math.hypot(a.x - b.x, a.y - b.y);
    if (distance < 170) { ctx.strokeStyle = `rgba(113, 180, 239, ${0.10 - distance / 1600})`; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
  }
  for (const point of points) { ctx.fillStyle = "rgba(160, 207, 246, 0.35)"; ctx.beginPath(); ctx.arc(point.x, point.y, 1.5, 0, Math.PI * 2); ctx.fill(); }
  clickParticles = clickParticles.filter((particle) => particle.life > 0);
  for (const particle of clickParticles) { particle.x += particle.vx; particle.y += particle.vy; particle.vx *= 0.95; particle.vy *= 0.95; particle.life -= 1; ctx.fillStyle = `rgba(210, 230, 255, ${Math.max(particle.life / 52, 0) * 0.72})`; ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill(); }
  if (!prefersReducedMotion) requestAnimationFrame(drawSignal);
}

function spawnClickParticles(x, y) {
  if (prefersReducedMotion) return;
  for (let i = 0; i < 18; i += 1) { const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.35; const speed = 0.8 + Math.random() * 2.2; clickParticles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 34 + Math.random() * 18, size: 1.2 + Math.random() * 2.6 }); }
}

resizeCanvas();
refreshTaipeiWeather();
drawSignal();
window.setInterval(refreshTaipeiWeather, 30 * 60 * 1000);
window.setInterval(() => setWeather(weather, "local"), 60 * 1000);
window.addEventListener("resize", resizeCanvas);
window.addEventListener("pointerdown", (event) => spawnClickParticles(event.clientX, event.clientY));

// Client-side content console. Entries are saved in this browser via localStorage.
(() => {
  const STORAGE_KEY = "chih-security-blog-content-v1";
  // SHA-256 of the current admin password. Change this value before publishing.
  const ADMIN_PASSWORD_HASH = "41e5094374ab5e77bef0d5ddf514d33eee0342b4f9395744f9604dd7da8fe0bc";
  const isAdminRoute = window.location.pathname.replace(/\/+$/, "") === "/admin" || new URLSearchParams(window.location.search).get("admin") === "1";
  const timelineRoot = document.querySelector("#timeline .timeline");
  const notesRoot = document.querySelector("#notes .resource-grid");
  const writeupsRoot = document.querySelector("#writeups .resource-grid");
  const lifeRoot = document.querySelector("#life .life-feed");
  if (!timelineRoot || !notesRoot || !writeupsRoot || !lifeRoot) return;

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const getInitialData = () => ({
    timeline: [...timelineRoot.querySelectorAll(".timeline-item")].map((item) => ({
      id: uid(),
      year: item.querySelector(".timeline-date span")?.textContent.trim() || "",
      month: item.querySelector(".timeline-date strong")?.textContent.trim() || "",
      type: item.querySelector(".resource-type")?.textContent.trim() || "Individual",
      title: item.querySelector("h3")?.textContent.trim() || "",
      description: item.querySelector("p")?.textContent.trim() || "",
      rank: item.querySelector(".timeline-meta div:first-child dd")?.textContent.trim() || "",
      mode: item.querySelector(".timeline-meta div:last-child dd")?.textContent.trim() || "",
    })),
    notes: [...notesRoot.querySelectorAll(".resource-card")].map((card) => ({
      id: uid(), title: card.querySelector("h3")?.textContent.trim() || "",
      description: card.querySelector("p")?.textContent.trim() || "",
      url: card.href || "", type: "Note",
    })),
    writeups: [...writeupsRoot.querySelectorAll(".resource-card")].map((card) => ({
      id: uid(), title: card.querySelector("h3")?.textContent.trim() || "",
      description: card.querySelector("p")?.textContent.trim() || "",
      url: card.href || "", type: "Write-up",
    })),
    life: [...lifeRoot.querySelectorAll(".life-card")].map((item) => ({
      id: uid(),
      date: item.querySelector("time")?.dateTime || "",
      title: item.querySelector("h3")?.textContent.trim() || "",
      preview: item.querySelector(".life-card__excerpt")?.textContent.trim() || "",
      description: item.dataset.fullText || item.querySelector(".life-card__excerpt")?.textContent.trim() || "",
    })),
  });

  const normalizeLifeEntry = (entry) => {
    let description = entry.description || "";
    if (entry.image && !description.includes(entry.image)) {
      description = description ? `${description}\n[${entry.image}]` : `[${entry.image}]`;
    }
    return {
      id: entry.id || uid(),
      date: entry.date || "",
      title: entry.title || "",
      preview: entry.preview || lifeExcerpt(description),
      description,
    };
  };

  const initialData = getInitialData();
  const cloneInitialData = () => JSON.parse(JSON.stringify(initialData));
  const load = () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!stored) return cloneInitialData();
      const merged = { ...cloneInitialData(), ...stored };
      merged.life = Array.isArray(stored.life) ? stored.life.map(normalizeLifeEntry) : [];
      return merged;
    } catch {
      return cloneInitialData();
    }
  };
  let data = load();
  let isDirty = false;
  const save = () => localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  const markDirty = () => {
    isDirty = true;
    updateSaveButton();
  };
  const markClean = () => {
    isDirty = false;
    updateSaveButton();
  };

  function renderTimeline() {
    timelineRoot.innerHTML = data.timeline.map((entry) => `
      <article class="timeline-item">
        <div class="timeline-date"><span>${escapeHtml(entry.year)}</span><strong>${escapeHtml(entry.month)}</strong></div>
        <div class="timeline-card">
          <span class="resource-type">${escapeHtml(entry.type)}</span>
          <h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.description)}</p>
          <dl class="timeline-meta"><div><dt>Rank</dt><dd>${escapeHtml(entry.rank)}</dd></div><div><dt>Mode</dt><dd>${escapeHtml(entry.mode)}</dd></div></dl>
        </div>
      </article>`).join("");
  }

  function resourceTypeLabel(kind, entry, index) {
    if (entry.type) return `${entry.type} ${String(index + 1).padStart(2, "0")}`;
    if (kind === "notes") return `Note ${String(index + 1).padStart(2, "0")}`;
    return `Write-up ${String(index + 1).padStart(2, "0")}`;
  }

  function lifePlainText(text) {
    return String(text || "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line && !isImageMarkdown(line) && !isImageSource(line))
      .join(" ");
  }

  function isImageSource(value) {
    const source = String(value || "").trim();
    return /^(?:https?:\/\/|blob:|file:\/\/\/|data:image\/)/i.test(source)
      || /(?:^|\/)[^/]+\.(?:png|jpe?g|gif|webp|avif|svg)(?:\?.*)?$/i.test(source);
  }

  function imageMarkdown(line) {
    const match = String(line || "").match(/^!?\[([^\]]*)\]\(([^\s)]+)\)$/);
    if (match && isImageSource(match[2])) return { alt: match[1], source: match[2] };

    const bracketUrl = String(line || "").match(/^\[([^\]\s]+)\]$/);
    if (bracketUrl && isImageSource(bracketUrl[1])) return { alt: "", source: bracketUrl[1] };

    return null;
  }

  function isImageMarkdown(line) {
    return Boolean(imageMarkdown(line));
  }

  function lifeExcerpt(text, max = 88) {
    const trimmed = lifePlainText(text).trim();
    if (trimmed.length <= max) return trimmed;
    return `${trimmed.slice(0, max)}…`;
  }

  function parseLifeContent(text) {
    const parts = [];
    for (const rawLine of String(text || "").split("\n")) {
      const line = rawLine.trim();
      if (!line) continue;

      const image = imageMarkdown(line);
      if (image) {
        parts.push(`<figure class="life-modal__figure"><img src="${escapeHtml(image.source)}" alt="${escapeHtml(image.alt)}" loading="lazy"></figure>`);
        continue;
      }

      if (isImageSource(line)) {
        parts.push(`<figure class="life-modal__figure"><img src="${escapeHtml(line)}" alt="" loading="lazy"></figure>`);
        continue;
      }

      parts.push(`<p>${escapeHtml(line)}</p>`);
    }
    return parts.join("") || `<p class="life-modal__empty">（尚無內容）</p>`;
  }

  function formatLifeDate(dateStr) {
    if (!dateStr) return "未設定日期";
    const parts = dateStr.split("-").map(Number);
    if (parts.length === 3 && parts.every((part) => !Number.isNaN(part))) {
      return `${parts[0]}年${parts[1]}月${parts[2]}日`;
    }
    return dateStr;
  }

  function renderLife() {
    const entries = [...data.life].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
    lifeRoot.innerHTML = entries.length ? entries.map((entry) => `
      <button class="life-card" type="button" data-life-id="${escapeHtml(entry.id)}" aria-haspopup="dialog">
        <time class="life-card__date" datetime="${escapeHtml(entry.date)}">${escapeHtml(formatLifeDate(entry.date))}</time>
        <div class="life-card__main">
          <h3>${escapeHtml(entry.title)}</h3>
          <p class="life-card__excerpt">${escapeHtml(entry.preview || lifeExcerpt(entry.description))}</p>
        </div>
        <span class="life-card__hint" aria-hidden="true">→</span>
      </button>`).join("") : `<div class="life-empty">尚無內容，可在 ADMIN 控制台新增。</div>`;
  }

  const lifeModalEl = document.createElement("section");
  lifeModalEl.className = "life-modal";
  lifeModalEl.hidden = true;
  lifeModalEl.innerHTML = `
    <div class="life-modal__backdrop" data-life-close tabindex="-1"></div>
    <div class="life-modal__panel" role="dialog" aria-modal="true" aria-labelledby="life-modal-title">
      <header class="life-modal__header">
        <div>
          <time class="life-modal__date" datetime=""></time>
          <h2 id="life-modal-title"></h2>
        </div>
        <button class="life-modal__close" type="button" data-life-close aria-label="關閉">×</button>
      </header>
      <div class="life-modal__body"></div>
    </div>`;
  document.body.append(lifeModalEl);

  const lifeModalDate = lifeModalEl.querySelector(".life-modal__date");
  const lifeModalTitle = lifeModalEl.querySelector("#life-modal-title");
  const lifeModalBody = lifeModalEl.querySelector(".life-modal__body");

  function openLifeModal(id) {
    const entry = data.life.find((item) => item.id === id);
    if (!entry) return;
    lifeModalDate.dateTime = entry.date || "";
    lifeModalDate.textContent = formatLifeDate(entry.date);
    lifeModalTitle.textContent = entry.title || "未命名";
    lifeModalBody.innerHTML = parseLifeContent(entry.description);
    lifeModalEl.hidden = false;
    document.body.classList.add("life-open");
    lifeModalEl.querySelector(".life-modal__close").focus();
  }

  function closeLifeModal() {
    lifeModalEl.hidden = true;
    document.body.classList.remove("life-open");
  }

  lifeRoot.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-life-id]");
    if (!trigger) return;
    openLifeModal(trigger.dataset.lifeId);
  });

  lifeModalEl.addEventListener("click", (event) => {
    if (event.target.matches("[data-life-close]")) closeLifeModal();
  });

  function renderResources(kind, root) {
    const cards = data[kind].map((entry, index) => `
      <a class="resource-card ${kind === "writeups" ? "writeup-card" : ""}" href="${escapeHtml(entry.url || "#")}" target="_blank" rel="noreferrer">
        <span class="resource-type">${escapeHtml(resourceTypeLabel(kind, entry, index))}</span>
        <h3>${escapeHtml(entry.title)}</h3><p>${escapeHtml(entry.description)}</p>
      </a>`).join("");
    root.innerHTML = cards || `<div class="resource-empty">尚無內容，可在 ADMIN 控制台新增。</div>`;
  }

  function render() {
    renderTimeline();
    renderResources("notes", notesRoot);
    renderResources("writeups", writeupsRoot);
    renderLife();
  }

  const consoleEl = document.createElement("section");
  consoleEl.className = "admin-console";
  consoleEl.hidden = true;
  consoleEl.innerHTML = `
    <div class="admin-console__backdrop" data-admin-close></div>
    <div class="admin-console__panel" role="dialog" aria-modal="true" aria-labelledby="admin-title">
      <header class="admin-console__header"><div><p>Content management</p><h2 id="admin-title">ADMIN CONSOLE</h2></div><button class="admin-icon-button" type="button" data-admin-close aria-label="關閉控制台">×</button></header>
      <div class="admin-console__toolbar"><button class="admin-tab is-active" type="button" data-tab="timeline">時間線</button><button class="admin-tab" type="button" data-tab="notes">筆記</button><button class="admin-tab" type="button" data-tab="writeups">Write-up</button><button class="admin-tab" type="button" data-tab="life">Life</button><span></span><button class="admin-primary" type="button" data-save disabled>儲存</button><button class="admin-secondary" type="button" data-reset>還原預設</button><button class="admin-primary" type="button" data-add>＋ 新增項目</button></div>
      <div class="admin-console__list" data-list></div>
      <p class="admin-console__notice">資料儲存在此瀏覽器（localStorage）。部署到其他裝置或清除瀏覽器資料後不會保留。</p>
    </div>`;
  document.body.append(consoleEl);

  let activeKind = "timeline";
  const list = consoleEl.querySelector("[data-list]");
  const saveButton = consoleEl.querySelector("[data-save]");
  const labels = { timeline: "時間線", notes: "筆記", writeups: "Write-up", life: "Life" };
  const defaultType = { notes: "Note", writeups: "Write-up" };
  const todayIso = () => new Date().toISOString().slice(0, 10);
  const emptyEntry = (kind) => {
    if (kind === "timeline") {
      return { id: uid(), year: new Date().getFullYear(), month: "", type: "Individual", title: "", description: "", rank: "", mode: "" };
    }
    if (kind === "life") {
      return { id: uid(), date: todayIso(), title: "", preview: "", description: "" };
    }
    return { id: uid(), title: "", description: "", url: "", type: defaultType[kind] || "Note" };
  };

  function updateSaveButton() {
    if (!saveButton) return;
    saveButton.disabled = !isDirty;
    saveButton.textContent = isDirty ? "儲存 *" : "已儲存";
  }

  function persistChanges() {
    try {
      save();
      render();
      markClean();
    } catch (error) {
      if (error?.name === "QuotaExceededError") {
        window.alert("Image is too large for this browser storage. Use a smaller image or a URL.");
        return;
      }
      throw error;
    }
  }

  updateSaveButton();

  function field(label, key, value, type = "text") { return `<label><span>${label}</span><input type="${type}" data-field="${key}" value="${escapeHtml(value)}"></label>`; }
  function drawEditor() {
    consoleEl.querySelectorAll("[data-tab]").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === activeKind));
    list.innerHTML = data[activeKind].length ? data[activeKind].map((entry) => {
      let fields = "";
      if (activeKind === "timeline") {
        fields = `${field("年份", "year", entry.year, "number")}${field("月份／日期", "month", entry.month)}${field("類型", "type", entry.type)}${field("活動名稱", "title", entry.title)}${field("排名", "rank", entry.rank)}${field("模式", "mode", entry.mode)}<label class="admin-field--wide"><span>說明</span><textarea data-field="description">${escapeHtml(entry.description)}</textarea></label>`;
      } else if (activeKind === "life") {
        fields = `${field("日期", "date", entry.date, "date")}${field("標題", "title", entry.title)}${field("預覽文字", "preview", entry.preview)}<label class="admin-field--wide"><span>完整內容（支援 Markdown 圖片；可直接貼上本機圖片）</span><textarea data-field="description" placeholder="這是我去的第一個地方&#10;[圖片說明](https://圖片網址)&#10;&#10;這是我去的第二個地方&#10;直接在此貼上本機圖片">${escapeHtml(entry.description)}</textarea></label>`;
      } else {
        fields = `${field("標題", "title", entry.title)}${field("連結", "url", entry.url, "url")}${field("標籤", "type", entry.type)}<label class="admin-field--wide"><span>摘要</span><textarea data-field="description">${escapeHtml(entry.description)}</textarea></label>`;
      }
      return `<article class="admin-entry" data-id="${entry.id}"><div class="admin-entry__title"><strong>${escapeHtml(entry.title || "未命名" )}</strong><button type="button" data-delete aria-label="刪除此項目">刪除</button></div><div class="admin-fields">${fields}</div></article>`;
    }).join("") : `<div class="admin-empty">尚無${labels[activeKind]}，按「新增項目」開始建立。</div>`;
  }

  async function hashPassword(password) {
    const bytes = new TextEncoder().encode(password);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }

  async function openConsole() {
    const password = window.prompt("ADMIN password");
    if (password === null) return;
    if ((await hashPassword(password)) !== ADMIN_PASSWORD_HASH) {
      window.alert("Password incorrect.");
      return;
    }
    consoleEl.hidden = false;
    document.body.classList.add("admin-open");
    updateSaveButton();
    drawEditor();
  }

  function closeConsole() { consoleEl.hidden = true; document.body.classList.remove("admin-open"); }
  consoleEl.addEventListener("click", (event) => {
    if (event.target.matches("[data-admin-close]")) {
      if (isDirty && !confirm("尚有未儲存的變更，確定要關閉？")) return;
      closeConsole();
    }
    if (event.target.matches("[data-tab]")) { activeKind = event.target.dataset.tab; drawEditor(); }
    if (event.target.matches("[data-save]")) persistChanges();
    if (event.target.matches("[data-add]")) { data[activeKind].unshift(emptyEntry(activeKind)); markDirty(); drawEditor(); }
    if (event.target.matches("[data-reset]") && confirm("確定還原所有預設內容？")) {
      localStorage.removeItem(STORAGE_KEY);
      data = cloneInitialData();
      save();
      render();
      markClean();
      drawEditor();
    }
    if (event.target.matches("[data-delete]") && confirm("確定刪除此項目？")) {
      const id = event.target.closest(".admin-entry").dataset.id;
      data[activeKind] = data[activeKind].filter((entry) => entry.id !== id);
      markDirty();
      drawEditor();
    }
  });
  list.addEventListener("input", (event) => {
    const input = event.target; const key = input.dataset.field; if (!key) return;
    const entry = data[activeKind].find((item) => item.id === input.closest(".admin-entry").dataset.id);
    if (!entry) return;
    entry[key] = input.value;
    markDirty();
    input.closest(".admin-entry").querySelector(".admin-entry__title strong").textContent = entry.title || "未命名";
  });

  // A pasted local image is kept as a data URL, so it can still be displayed
  // after a refresh without needing a separate upload server.
  list.addEventListener("paste", (event) => {
    const textarea = event.target;
    if (activeKind !== "life" || textarea.tagName !== "TEXTAREA" || textarea.dataset.field !== "description") return;

    const imageItem = [...(event.clipboardData?.items || [])].find((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (!imageItem) return;

    event.preventDefault();
    const imageFile = imageItem.getAsFile();
    if (!imageFile) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const imageUrl = String(reader.result || "");
      if (!imageUrl.startsWith("data:image/")) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const prefix = textarea.value.slice(0, start);
      const suffix = textarea.value.slice(end);
      const lineBreak = prefix && !prefix.endsWith("\n") ? "\n" : "";
      const markdown = `![貼上的圖片](${imageUrl})`;
      textarea.value = `${prefix}${lineBreak}${markdown}${suffix}`;
      const cursor = (prefix + lineBreak + markdown).length;
      textarea.setSelectionRange(cursor, cursor);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    });
    reader.readAsDataURL(imageFile);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !lifeModalEl.hidden) {
      closeLifeModal();
      return;
    }
    if (event.key === "Escape" && !consoleEl.hidden) {
      if (isDirty && !confirm("尚有未儲存的變更，確定要關閉？")) return;
      closeConsole();
    }
  });
  render();
  if (isAdminRoute) openConsole();
})();
