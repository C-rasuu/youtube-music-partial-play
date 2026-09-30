// ==UserScript==
// @name         YouTube Music Partial Play (Stable)
// @namespace    https://example.com/ytm-partial-play
// @version      1.0.0
// @match        https://music.youtube.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  // ========================================================================
  // ここから編集用データ
  // 形式: { title, url, start, end }
  // ========================================================================
  const PARTIAL_PLAY_DATA = [
    {
      title: "世界は恋に落ちている",
      url: "https://music.youtube.com/watch?v=QHRSH-MoM_A&si=xSOd0iZStbQRbL72",
      start: 2452,
      end: 2760,
      artist: "",
      thumbnail: ""
    }
  ];
  // ========================================================================
  // ここまで編集用データ
  // ========================================================================

  const BUTTON_ID = "ytm-pp-stable-button";
  const PANEL_ID = "ytm-pp-stable-panel";
  const STYLE_ID = "ytm-pp-stable-style";

  const state = {
    entries: PARTIAL_PLAY_DATA.slice(),
    currentIndex: 0,
    timer: null
  };

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed !important;
        right: 16px !important;
        bottom: 100px !important;
        z-index: 2147483647 !important;
        border: none !important;
        background: #ff0033 !important;
        color: #fff !important;
        padding: 10px 16px !important;
        border-radius: 999px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.35) !important;
        cursor: pointer !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
      }

      #${PANEL_ID} {
        position: fixed !important;
        right: 16px !important;
        bottom: 154px !important;
        width: min(360px, calc(100vw - 24px)) !important;
        max-height: 70vh !important;
        background: rgba(20,20,20,0.98) !important;
        color: #fff !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        border-radius: 14px !important;
        box-shadow: 0 18px 30px rgba(0,0,0,0.35) !important;
        overflow: hidden !important;
        z-index: 2147483646 !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
      }

      #${PANEL_ID}.hidden {
        display: none !important;
      }

      .ytm-pp-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 12px 14px !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        background: rgba(255,255,255,0.02) !important;
      }

      .ytm-pp-header-title {
        font-size: 16px !important;
        font-weight: 700 !important;
        color: #fff !important;
      }

      .ytm-pp-close {
        border: none !important;
        background: transparent !important;
        color: #fff !important;
        font-size: 22px !important;
        line-height: 1 !important;
        cursor: pointer !important;
        padding: 0 !important;
      }

      .ytm-pp-body {
        max-height: calc(70vh - 52px) !important;
        overflow-y: auto !important;
        padding: 10px !important;
      }

      .ytm-pp-list {
        display: grid !important;
        gap: 8px !important;
      }

      .ytm-pp-item {
        display: grid !important;
        grid-template-columns: 56px 1fr auto !important;
        align-items: center !important;
        gap: 8px !important;
        background: rgba(255,255,255,0.02) !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 10px !important;
        padding: 8px !important;
      }

      .ytm-pp-thumb {
        width: 56px !important;
        height: 56px !important;
        object-fit: cover !important;
        border-radius: 8px !important;
        display: block !important;
        background: #222 !important;
      }

      .ytm-pp-main {
        min-width: 0 !important;
      }

      .ytm-pp-item-title {
        font-size: 13px !important;
        font-weight: 700 !important;
        color: #fff !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .ytm-pp-item-artist {
        font-size: 11px !important;
        color: rgba(255,255,255,0.65) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .ytm-pp-item-time {
        font-size: 11px !important;
        color: #ffc5d0 !important;
        margin-top: 4px !important;
      }

      .ytm-pp-play {
        border: 1px solid rgba(255,255,255,0.10) !important;
        background: rgba(255,255,255,0.04) !important;
        color: #fff !important;
        border-radius: 8px !important;
        padding: 7px 10px !important;
        font-size: 12px !important;
        cursor: pointer !important;
      }

      .ytm-pp-empty {
        padding: 20px 10px !important;
        color: rgba(255,255,255,0.7) !important;
        font-size: 13px !important;
        text-align: center !important;
      }
    `;

    document.head.appendChild(style);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatSeconds(value) {
    const total = Math.max(0, Number(value) || 0);
    const minute = Math.floor(total / 60);
    const second = Math.floor(total % 60);
    return `${minute}:${String(second).padStart(2, "0")}`;
  }

  function getMediaElement() {
    return document.querySelector("video");
  }

  function waitForMedia(timeoutMs = 5000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const loop = () => {
        const media = getMediaElement();
        if (media) return resolve(media);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(loop, 150);
      };
      loop();
    });
  }

  function getVideoIdFromUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        return u.pathname.replace("/", "").split("?")[0] || "";
      }
      if (u.hostname.includes("youtube.com")) {
        if (u.searchParams.get("v")) return u.searchParams.get("v");
        if (u.pathname.includes("/shorts/")) return u.pathname.split("/shorts/")[1].split("/")[0];
        if (u.pathname.includes("/embed/")) return u.pathname.split("/embed/")[1].split("/")[0];
      }
      return "";
    } catch {
      return "";
    }
  }

  async function fetchOEmbed(url) {
    const videoId = getVideoIdFromUrl(url);
    if (!videoId) {
      return { title: "不明", author_name: "不明", thumbnail_url: "" };
    }

    try {
      const resp = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`, {
        cache: "force-cache"
      });
      if (!resp.ok) throw new Error("oEmbed failed");
      return await resp.json();
    } catch {
      return { title: "不明", author_name: "不明", thumbnail_url: "" };
    }
  }

  async function hydrateEntries() {
    for (const entry of state.entries) {
      if (!entry.artist || !entry.thumbnail) {
        const meta = await fetchOEmbed(entry.url);
        entry.artist = meta.author_name || "不明";
        entry.thumbnail = meta.thumbnail_url || "";
      }
    }
  }

  function renderPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    if (!state.entries.length) {
      panel.innerHTML = `
        <div class="ytm-pp-header">
          <div class="ytm-pp-header-title">部分再生</div>
          <button class="ytm-pp-close" type="button" aria-label="閉じる">×</button>
        </div>
        <div class="ytm-pp-body">
          <div class="ytm-pp-empty">リストが空です</div>
        </div>
      `;
      panel.querySelector(".ytm-pp-close").addEventListener("click", () => {
        panel.classList.add("hidden");
      });
      return;
    }

    panel.innerHTML = `
      <div class="ytm-pp-header">
        <div class="ytm-pp-header-title">部分再生</div>
        <button class="ytm-pp-close" type="button" aria-label="閉じる">×</button>
      </div>
      <div class="ytm-pp-body">
        <div class="ytm-pp-list">
          ${state.entries.map((entry, index) => {
            const thumbnail = entry.thumbnail
              ? `<img class="ytm-pp-thumb" src="${entry.thumbnail}" alt="${escapeHtml(entry.title)}" />`
              : `<div class="ytm-pp-thumb" style="display:flex;align-items:center;justify-content:center;background:#222;color:#fff;">♪</div>`;

            return `
              <div class="ytm-pp-item">
                ${thumbnail}
                <div class="ytm-pp-main">
                  <div class="ytm-pp-item-title">${escapeHtml(entry.title)}</div>
                  <div class="ytm-pp-item-artist">${escapeHtml(entry.artist || "不明")}</div>
                  <div class="ytm-pp-item-time">${formatSeconds(entry.start)}〜${formatSeconds(entry.end)}</div>
                </div>
                <button class="ytm-pp-play" type="button" data-index="${index}">再生</button>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    `;

    panel.querySelector(".ytm-pp-close").addEventListener("click", () => {
      panel.classList.add("hidden");
    });

    panel.querySelectorAll(".ytm-pp-play").forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.getAttribute("data-index"));
        playEntryAtIndex(idx);
      });
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
        advanceToNext();
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
    media.currentTime = Math.max(0, entry.start || 0);
    media.play();
    startPartialPlaybackMonitoring(media, entry);
  }

  function advanceToNext() {
    if (!state.entries.length) return;
    const nextIndex = (state.currentIndex + 1) % state.entries.length;
    state.currentIndex = nextIndex;
    playEntryAtIndex(nextIndex);
  }

  function createPanel() {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement("div");
      panel.id = PANEL_ID;
      panel.className = "hidden";
      document.body.appendChild(panel);
    }
    renderPanel();
  }

  function createButton() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "部分再生";
    button.addEventListener("click", () => {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      panel.classList.toggle("hidden");
    });

    document.body.appendChild(button);
  }

  async function init() {
    await hydrateEntries();
    ensureStyle();
    createButton();
    createPanel();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
