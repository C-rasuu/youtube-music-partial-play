// ==UserScript==
// @name         YouTube Music Partial Play
// @namespace    https://example.com/ytm-partial-play
// @version      1.0.0
// @match        https://music.youtube.com/*
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

(() => {
  "use strict";

  // ========================================
  // 📝 ここから: データ入力エリア
  // ========================================
  // 以下の形式で随時追加してください
  // {
  //   title: "タイトル",
  //   url: "YouTube Musicの曲や動画のリンク",
  //   start: 再生開始時間（秒）,
  //   end: 再生終了時間（秒）
  // }
  //
  // 例:
  // {
  //   title: "イントロ部分のみ",
  //   url: "https://music.youtube.com/watch?v=dQw4w9WgXcQ",
  //   start: 0,
  //   end: 30
  // }

  const PARTIAL_PLAY_DATA = [
    // ↓↓↓ ここから下に随時追加してください ↓↓↓

    {
      title: "サンプル曲1",
      url: "https://music.youtube.com/watch?v=example1",
      start: 0,
      end: 60
    },

    {
      title: "サンプル曲2",
      url: "https://music.youtube.com/watch?v=example2",
      start: 30,
      end: 90
    }

    // ↑↑↑ ここまでに追加してください ↑↑↑
  ];

  // ========================================
  // 📝 ここまで: データ入力エリア
  // ========================================

  const APP_ID = "ytm-partial-play-app";
  const STYLE_ID = "ytm-partial-play-style";

  const state = {
    entries: PARTIAL_PLAY_DATA.slice(),
    currentIndex: -1,
    timer: null
  };

  function toNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function validUrl(url) {
    if (!url || typeof url !== "string") return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  function getVideoIdFromUrl(value) {
    try {
      const url = new URL(value);
      if (url.hostname.includes("youtu.be")) {
        return url.pathname.replace("/", "").split("?")[0] || "";
      }
      if (url.hostname.includes("youtube.com")) {
        if (url.searchParams.get("v")) return url.searchParams.get("v");
        if (url.pathname.includes("/shorts/")) return url.pathname.split("/shorts/")[1].split("/")[0];
        if (url.pathname.includes("/embed/")) return url.pathname.split("/embed/")[1].split("/")[0];
      }
      return "";
    } catch {
      return "";
    }
  }

  async function fetchOEmbed(url) {
    const videoId = getVideoIdFromUrl(url);
    if (!videoId) {
      return {
        title: "不明",
        author_name: "不明",
        thumbnail_url: ""
      };
    }

    try {
      const response = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { cache: "force-cache" }
      );
      if (!response.ok) throw new Error("oEmbed fail");
      return await response.json();
    } catch {
      return {
        title: "不明",
        author_name: "不明",
        thumbnail_url: ""
      };
    }
  }

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${APP_ID} {
        position: fixed;
        right: 16px;
        bottom: 78px;
        width: min(360px, calc(100vw - 28px));
        max-height: 72vh;
        background: rgba(18,18,18,0.96);
        color: #fff;
        border: 1px solid rgba(255,255,255,0.12);
        border-radius: 16px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.5);
        z-index: 999999;
        overflow: hidden;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", "Segoe UI", sans-serif;
      }

      #${APP_ID}.hidden { display: none; }

      .ytm-pp-header {
        padding: 12px 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        background: rgba(255,255,255,0.02);
      }

      .ytm-pp-title {
        font-size: 15px;
        font-weight: 700;
      }

      .ytm-pp-close {
        background: transparent;
        color: #fff;
        border: none;
        font-size: 20px;
        cursor: pointer;
        opacity: 0.8;
      }

      .ytm-pp-body {
        padding: 12px;
        max-height: calc(72vh - 52px);
        overflow-y: auto;
      }

      .ytm-pp-list {
        display: grid;
        gap: 8px;
      }

      .ytm-pp-item {
        display: grid;
        grid-template-columns: 56px 1fr auto;
        gap: 8px;
        align-items: center;
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        background: rgba(255,255,255,0.02);
        padding: 8px;
      }

      .ytm-pp-item img {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border-radius: 8px;
        background: #222;
      }

      .ytm-pp-text {
        min-width: 0;
      }

      .ytm-pp-item-title {
        font-size: 13px;
        font-weight: 700;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ytm-pp-item-artist {
        font-size: 11px;
        color: rgba(255,255,255,0.65);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ytm-pp-item-time {
        font-size: 11px;
        color: #f5b4b4;
        margin-top: 2px;
      }

      .ytm-pp-item-btn {
        background: rgba(255,255,255,0.08);
        border: 1px solid rgba(255,255,255,0.1);
        color: white;
        border-radius: 8px;
        padding: 7px 9px;
        cursor: pointer;
        font-size: 12px;
      }

      .ytm-pp-empty {
        color: rgba(255,255,255,0.7);
        font-size: 13px;
        padding: 12px 8px;
      }
    `;
    document.head.appendChild(style);
  }

  function createSidebarToggle() {
    const existing = document.getElementById("ytm-partial-play-side-button");
    if (existing) return existing;

    const button = document.createElement("button");
    button.id = "ytm-partial-play-side-button";
    button.type = "button";
    button.textContent = "部分再生";
    button.style.cssText = `
      display: block;
      width: 100%;
      padding: 12px 16px;
      margin-top: 8px;
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 12px;
      background: rgba(255,255,255,0.04);
      color: #fff;
      text-align: left;
      cursor: pointer;
      font-size: 14px;
      font-weight: 600;
    `;

    button.addEventListener("click", () => {
      const app = document.getElementById(APP_ID);
      if (app) app.classList.toggle("hidden");
    });

    const navCandidates = [
      ...document.querySelectorAll("nav, aside, [role='navigation'], ytmusic-nav, ytmusic-guide-renderer")
    ];

    let target = null;
    for (const node of navCandidates) {
      const text = (node.textContent || "").replace(/\s+/g, "");
      if (text.includes("ホーム") || text.includes("探索") || text.includes("ライブラリ")) {
        target = node;
        break;
      }
    }

    if (target) {
      target.appendChild(button);
    } else {
      document.body.appendChild(button);
    }

    return button;
  }

  function createApp() {
    const existing = document.getElementById(APP_ID);
    if (existing) return existing;

    const app = document.createElement("div");
    app.id = APP_ID;
    app.className = "hidden";

    app.innerHTML = `
      <div class="ytm-pp-header">
        <div class="ytm-pp-title">部分再生</div>
        <button class="ytm-pp-close" type="button" aria-label="閉じる">×</button>
      </div>
      <div class="ytm-pp-body">
        <div class="ytm-pp-list" id="ytm-pp-list"></div>
      </div>
    `;

    const closeBtn = app.querySelector(".ytm-pp-close");
    closeBtn.addEventListener("click", () => app.classList.add("hidden"));

    document.body.appendChild(app);
    return app;
  }

  function renderEntries() {
    const list = document.getElementById("ytm-pp-list");
    if (!list) return;

    if (!state.entries.length) {
      list.innerHTML = '<div class="ytm-pp-empty">リストが空です。スクリプト内のデータを追加してください。</div>';
      return;
    }

    list.innerHTML = state.entries.map((entry, idx) => {
      const image = entry.thumbnail
        ? `<img src="${entry.thumbnail}" alt="${entry.title}" />`
        : `<img src="data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23222'/></svg>" />`;

      return `
        <div class="ytm-pp-item">
          ${image}
          <div class="ytm-pp-text">
            <div class="ytm-pp-item-title">${escapeHtml(entry.title)}</div>
            <div class="ytm-pp-item-artist">${escapeHtml(entry.artist)}</div>
            <div class="ytm-pp-item-time">${formatSeconds(entry.start)}〜${formatSeconds(entry.end)}</div>
          </div>
          <button class="ytm-pp-item-btn" data-index="${idx}" type="button">再生</button>
        </div>
      `;
    }).join("");

    list.querySelectorAll(".ytm-pp-item-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        playEntryAtIndex(idx);
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatSeconds(value) {
    const total = Math.max(0, Number(value) || 0);
    const m = Math.floor(total / 60);
    const s = Math.floor(total % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  function getMediaElement() {
    return document.querySelector("video");
  }

  function waitForMedia(ms = 2000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const media = getMediaElement();
        if (media) return resolve(media);
        if (Date.now() - start > ms) return resolve(null);
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  function stopCurrentMonitor() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
  }

  function startPartialPlaybackMonitoring(media, entry) {
    stopCurrentMonitor();

    state.timer = setInterval(() => {
      if (!media || media.paused) return;
      if (media.currentTime >= entry.end) {
        media.pause();
        advanceToNextEntry();
      }
    }, 200);
  }

  async function playEntryAtIndex(index) {
    const entry = state.entries[index];
    if (!entry) return;

    const media = await waitForMedia(5000);
    if (!media) {
      alert("YouTube Music を再生画面にしてから再生してください。");
      return;
    }

    state.currentIndex = index;

    media.currentTime = Math.max(0, entry.start);
    media.play();

    startPartialPlaybackMonitoring(media, entry);
  }

  function advanceToNextEntry() {
    if (!state.entries.length) return;

    const nextIndex = (state.currentIndex + 1) % state.entries.length;
    state.currentIndex = nextIndex;
    playEntryAtIndex(nextIndex);
  }

  async function initializeEntries() {
    for (const entry of state.entries) {
      if (!entry.artist || !entry.thumbnail) {
        const meta = await fetchOEmbed(entry.url);
        entry.artist = meta.author_name || "不明";
        entry.thumbnail = meta.thumbnail_url || "";
      }
    }
  }

  async function init() {
    await initializeEntries();
    ensureStyle();
    createApp();
    createSidebarToggle();
    renderEntries();

    const observer = new MutationObserver(() => {
      if (!document.getElementById("ytm-partial-play-side-button")) {
        createSidebarToggle();
      }
      if (!document.getElementById(APP_ID)) {
        createApp();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
