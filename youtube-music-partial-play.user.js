// ==UserScript==
// @name         YouTube Music Partial Play
// @namespace    https://example.com/ytm-partial-play
// @version      1.0.1
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
      title: "世界は恋に落ちている",
      url: "https://music.youtube.com/watch?v=QHRSH-MoM_A&si=xSOd0iZStbQRbL72",
      start: 2452,
      end: 2760
    }

    // ↑↑↑ ここまでに追加してください ↑↑↑
  ];

  // ========================================
  // 📝 ここまで: データ入力エリア
  // ========================================

  const STYLE_ID = "ytm-partial-play-style";
  const BUTTON_ID = "ytm-partial-play-toggle";
  const PANEL_ID = "ytm-partial-play-panel";

  const state = {
    entries: PARTIAL_PLAY_DATA.slice(),
    currentIndex: -1,
    timer: null,
    panelOpen: false
  };

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
      #${BUTTON_ID} {
        position: fixed !important;
        right: 18px !important;
        bottom: 124px !important;
        z-index: 2147483647 !important;
        border: none !important;
        border-radius: 999px !important;
        background: rgb(255, 0, 51) !important;
        color: white !important;
        font-weight: 800 !important;
        font-size: 14px !important;
        padding: 12px 18px !important;
        box-shadow: 0 12px 30px rgba(0,0,0,0.35) !important;
        cursor: pointer !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
      }

      #${PANEL_ID} {
        position: fixed !important;
        right: 18px !important;
        bottom: 182px !important;
        width: min(360px, calc(100vw - 36px)) !important;
        max-height: 60vh !important;
        background: rgb(18,18,18) !important;
        color: white !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        box-shadow: 0 18px 40px rgba(0,0,0,0.45) !important;
        overflow: hidden !important;
        z-index: 2147483646 !important;
        display: flex !important;
        flex-direction: column !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
      }

      #${PANEL_ID}.hidden {
        display: none !important;
      }

      .ytm-pp-panel-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 14px 16px !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        flex-shrink: 0 !important;
      }

      .ytm-pp-panel-title {
        font-size: 16px !important;
        font-weight: 700 !important;
      }

      .ytm-pp-panel-close {
        background: transparent !important;
        border: none !important;
        color: white !important;
        font-size: 24px !important;
        cursor: pointer !important;
        padding: 0 !important;
        width: 24px !important;
        height: 24px !important;
      }

      .ytm-pp-panel-body {
        padding: 12px !important;
        overflow-y: auto !important;
        flex: 1 !important;
      }

      .ytm-pp-list {
        display: grid !important;
        gap: 8px !important;
      }

      .ytm-pp-item {
        display: grid !important;
        grid-template-columns: 56px 1fr auto !important;
        gap: 8px !important;
        align-items: center !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 12px !important;
        background: rgba(255,255,255,0.02) !important;
        padding: 8px !important;
      }

      .ytm-pp-thumb {
        width: 56px !important;
        height: 56px !important;
        object-fit: cover !important;
        border-radius: 8px !important;
        background: #222 !important;
        flex-shrink: 0 !important;
      }

      .ytm-pp-main {
        min-width: 0 !important;
      }

      .ytm-pp-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        color: white !important;
      }

      .ytm-pp-artist {
        font-size: 11px !important;
        color: rgba(255,255,255,0.65) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        margin-top: 2px !important;
      }

      .ytm-pp-range {
        font-size: 11px !important;
        color: #f4b4b4 !important;
        margin-top: 2px !important;
      }

      .ytm-pp-play-btn {
        border: 1px solid rgba(255,255,255,0.1) !important;
        border-radius: 8px !important;
        background: rgba(255,255,255,0.08) !important;
        color: white !important;
        padding: 8px 10px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        flex-shrink: 0 !important;
      }

      .ytm-pp-empty {
        padding: 20px 8px !important;
        text-align: center !important;
        color: rgba(255,255,255,0.7) !important;
        font-size: 13px !important;
      }
    `;
    document.head.appendChild(style);
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

  function renderPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    if (!state.entries.length) {
      panel.innerHTML = `
        <div class="ytm-pp-panel-header">
          <div class="ytm-pp-panel-title">部分再生</div>
          <button class="ytm-pp-panel-close">×</button>
        </div>
        <div class="ytm-pp-panel-body">
          <div class="ytm-pp-empty">リストが空です</div>
        </div>
      `;
    } else {
      panel.innerHTML = `
        <div class="ytm-pp-panel-header">
          <div class="ytm-pp-panel-title">部分再生</div>
          <button class="ytm-pp-panel-close">×</button>
        </div>
        <div class="ytm-pp-panel-body">
          <div class="ytm-pp-list">
            ${state.entries.map((entry, idx) => {
              const thumb = entry.thumbnail
                ? `<img class="ytm-pp-thumb" src="${entry.thumbnail}" alt="${entry.title}" />`
                : `<div class="ytm-pp-thumb" style="display:flex;align-items:center;justify-content:center;background:#222;color:white;">🎵</div>`;

              return `
                <div class="ytm-pp-item">
                  ${thumb}
                  <div class="ytm-pp-main">
                    <div class="ytm-pp-title">${escapeHtml(entry.title)}</div>
                    <div class="ytm-pp-artist">${escapeHtml(entry.artist || "不明")}</div>
                    <div class="ytm-pp-range">${formatSeconds(entry.start)}〜${formatSeconds(entry.end)}</div>
                  </div>
                  <button class="ytm-pp-play-btn" data-index="${idx}" type="button">再生</button>
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `;
    }

    // イベントリスナーを設定
    const closeBtn = panel.querySelector(".ytm-pp-panel-close");
    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        togglePanel();
      });
    }

    const playBtns = panel.querySelectorAll(".ytm-pp-play-btn");
    playBtns.forEach((button) => {
      button.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(button.getAttribute("data-index"));
        playEntryAtIndex(idx);
      });
    });
  }

  function togglePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    state.panelOpen = !state.panelOpen;
    if (state.panelOpen) {
      panel.classList.remove("hidden");
    } else {
      panel.classList.add("hidden");
    }
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

  function createFloatingButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "部分再生";
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      togglePanel();
    });
    document.body.appendChild(button);
  }

  function createFloatingPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "hidden";
    document.body.appendChild(panel);
    renderPanel();
  }

  async function init() {
    await initializeEntries();
    ensureStyle();
    createFloatingButton();
    createFloatingPanel();
    renderPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
