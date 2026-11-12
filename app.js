let DATA = [];
let filtered = [];
let current = null;
let currentServer = 0;
let hls = null;
let activeCat = "همه";

const video = document.getElementById("video");
const listEl = document.getElementById("list");
const catsEl = document.getElementById("cats");
const qEl = document.getElementById("q");
const overlay = document.getElementById("overlay");
const nowName = document.getElementById("nowName");
const nowCat = document.getElementById("nowCat");
const serverBar = document.getElementById("serverBar");
const countEl = document.getElementById("count");

async function load() {
  const res = await fetch("channels.json?_=" + Date.now());
  const json = await res.json();
  DATA = json.channels || [];
  buildCats();
  applyFilter();
}

function buildCats() {
  const map = {};
  DATA.forEach(c => { map[c.category] = (map[c.category] || 0) + 1; });
  const cats = ["همه", ...Object.keys(map).sort((a,b) => map[b]-map[a])];
  catsEl.innerHTML = "";
  cats.forEach(cat => {
    const btn = document.createElement("button");
    btn.textContent = cat === "همه" ? `همه (${DATA.length})` : `${cat} (${map[cat]||0})`;
    btn.className = cat === activeCat ? "active" : "";
    btn.onclick = () => { activeCat = cat; buildCats(); applyFilter(); };
    catsEl.appendChild(btn);
  });
}

function applyFilter() {
  const q = (qEl.value || "").trim().toLowerCase();
  filtered = DATA.filter(c => {
    const okCat = activeCat === "همه" || c.category === activeCat;
    const okQ = !q || (c.name || "").toLowerCase().includes(q) || (c.category || "").includes(q);
    return okCat && okQ;
  });
  renderList();
}

function renderList() {
  listEl.innerHTML = "";
  filtered.forEach(c => {
    const div = document.createElement("div");
    div.className = "item" + (current && current.id === c.id ? " active" : "");
    div.innerHTML = `<div><div class="name">${escapeHtml(c.name)}</div><div class="meta">${escapeHtml(c.category)}</div></div><div class="badge">${c.servers.length} سرور</div>`;
    div.onclick = () => playChannel(c, 0);
    listEl.appendChild(div);
  });
  countEl.textContent = `${filtered.length} شبکه نمایش داده شد`;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m]));
}

function playChannel(ch, serverIndex) {
  current = ch;
  currentServer = Math.max(0, Math.min(serverIndex, ch.servers.length - 1));
  const url = ch.servers[currentServer];
  nowName.textContent = ch.name;
  nowCat.textContent = ch.category + (ch.referer ? " | نیاز به Referer ممکن است" : "");
  overlay.classList.add("hide");
  renderServers();
  renderList();
  startPlayback(url);
}

function renderServers() {
  serverBar.innerHTML = "";
  if (!current) return;
  current.servers.forEach((s, i) => {
    const btn = document.createElement("button");
    btn.textContent = "سرور " + (i + 1);
    btn.className = i === currentServer ? "active" : "";
    btn.onclick = () => playChannel(current, i);
    serverBar.appendChild(btn);
  });
}

function startPlayback(url) {
  if (hls) { try { hls.destroy(); } catch(e) {} hls = null; }
  video.pause();
  video.removeAttribute("src");
  video.load();

  if (window.Hls && Hls.isSupported()) {
    hls = new Hls({
      enableWorker: true,
      maxBufferLength: 30,
      xhrSetup: function (xhr) {
        // بعضی مرورگرها هدر سفارشی را برای cross-origin محدود می‌کنند
        try {
          if (current && current.ua) xhr.setRequestHeader("User-Agent", current.ua);
        } catch (e) {}
      }
    });
    hls.loadSource(url);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      video.play().catch(() => {});
    });
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal && current && currentServer < current.servers.length - 1) {
        // auto next server
        playChannel(current, currentServer + 1);
      }
    });
  } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url;
    video.play().catch(() => {});
  } else {
    overlay.classList.remove("hide");
    overlay.textContent = "مرورگر از HLS پشتیبانی نمی‌کند";
  }
}

qEl.addEventListener("input", applyFilter);
load().catch(err => {
  overlay.classList.remove("hide");
  overlay.textContent = "خطا در بارگذاری کانال‌ها";
  console.error(err);
});
