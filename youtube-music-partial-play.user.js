// ==UserScript==
// @name         YouTube Music Partial Play (Fixed UI)
// @namespace    https://example.com/ytm-partial-play
// @version      1.0.0
// @match        https://music.youtube.com/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  // =========================================================
  // ここに追記していく
  // 形式:
  // {
  //   title: "タイトル",
  //   url: "YouTube Music の曲や動画リンク",
  //   start: 再生開始時間（秒）,
  //   end: 再生終了時間（秒）
  // }
  // =========================================================
  const PARTIAL_PLAY_DATA = [
    {
      title: "世界は恋に落ちている",
      url: "https://music.youtube.com/watch?v=QHRSH-MoM_A&si=xSOd0iZStbQRbL72",
      start: 2452,
      end: 2760
    }
  ];
  // =========================================================

  const STYLE_ID = "ytm-partial-play-style";
  const BUTTON_ID = "ytm-partial-play-btn";
  const PANEL_ID = "ytm-partial-play-panel";

  const state = {
    entries: PARTIAL_PLAY_DATA.slice(),
    currentIndex: 0,
    isPlaying: false,
    timer: null,
    panelOpen: false
  };

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} {
        position: fixed !important;
        right: 16px !important;
        bottom: 96px !important;
        z-index: 2147483647 !important;
        border: none !important;
        background: #ff0033 !important;
        color: #fff !important;
        border-radius: 999px !important;
        padding: 10px 16px !important;
        font-size: 14px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        box-shadow: 0 10px 24px rgba(0,0,0,0.35) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
        writing-mode: horizontal-tb !important;
        text-orientation: mixed !important;
      }

      #${PANEL_ID} {
        position: fixed !important;
        right: 16px !important;
        bottom: 152px !important;
        width: min(320px, calc(100vw - 24px)) !important;
        max-height: 50vh !important;
        background: rgba(18,18,18,0.98) !important;
        color: #fff !important;
        border: 1px solid rgba(255,255,255,0.12) !important;
        border-radius: 12px !important;
        overflow: hidden !important;
        z-index: 2147483646 !important;
        box-shadow: 0 18px 30px rgba(0,0,0,0.35) !important;
        font-family: -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif !important;
        writing-mode: horizontal-tb !important;
      }

      #${PANEL_ID}.hidden {
        display: none !important;
      }

      .ytm-pp-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 10px 12px !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        background: rgba(255,255,255,0.02) !important;
      }

      .ytm-pp-title {
        font-size: 14px !important;
        font-weight: 700 !important;
        color: #fff !important;
      }

      .ytm-pp-close {
        background: transparent !important;
        border: none !important;
        color: #fff !important;
        font-size: 20px !important;
        cursor: pointer !important;
      }

      .ytm-pp-body {
        max-height: calc(50vh - 42px) !important;
        overflow-y: auto !important;
        padding: 8px !important;
      }

      .ytm-pp-list {
        display: grid !important;
        gap: 6px !important;
      }

      .ytm-pp-item {
        display: grid !important;
        grid-template-columns: 48px 1fr auto !important;
        gap: 6px !important;
        align-items: center !important;
        padding: 6px !important;
        border: 1px solid rgba(255,255,255,0.08) !important;
        border-radius: 8px !important;
        background: rgba(255,255,255,0.02) !important;
      }

      .ytm-pp-thumb {
        width: 48px !important;
        height: 48px !important;
        object-fit: cover !important;
        border-radius: 6px !important;
        background: #222 !important;
        display: block !important;
      }

      .ytm-pp-info {
        min-width: 0 !important;
      }

      .ytm-pp-item-title {
        font-size: 12px !important;
        font-weight: 700 !important;
        color: #fff !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }

      .ytm-pp-item-artist {
        font-size: 10px !important;
        color: rgba(255,255,255,0.65) !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
        margin-top: 1px !important;
      }

      .ytm-pp-item-time {
        font-size: 10px !important;
        color: #f6bfd0 !important;
        margin-top: 2px !important;
      }

      .ytm-pp-play-btn {
        background: rgba(255,255,255,0.04) !important;
        border: 1px solid rgba(255,255,255,0.10) !important;
        color: #fff !important;
        border-radius: 6px !important;
        padding: 5px 8px !important;
        font-size: 11px !important;
        cursor: pointer !important;
      }

      .ytm-pp-control-btn {
        background: #ff0033 !important;
        border: none !important;
        color: #fff !important;
        border-radius: 8px !important;
        padding: 8px 12px !important;
        font-size: 12px !important;
        font-weight: 700 !important;
        cursor: pointer !important;
        width: 100% !important;
        margin-top: 8px !important;
      }
    `;
    document.head.appendChild(style);
  }

  function formatSeconds(value) {
    const total = Math.max(0, Number(value) || 0);
    const min = Math.floor(total / 60);
    const sec = Math.floor(total % 60);
    return `${min}:${String(sec).padStart(2, "0")}`;
  }

  function getVideoIdFromUrl(url) {
    try {
      const u = new URL(url);
      if (u.hostname.includes("youtu.be")) {
        return (u.pathname.replace("/", "") || "").split("?")[0];
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
    const id = getVideoIdFromUrl(url);
    if (!id) return { author_name: "不明", thumbnail_url: "" };

    try {
      const res = await fetch(
        `https://www.youtube.com/oembed?url=${encodeURIComponent(url)}&format=json`,
        { cache: "force-cache" }
      );
      if (!res.ok) throw new Error("oEmbed failed");
      return await res.json();
    } catch {
      return { author_name: "不明", thumbnail_url: "" };
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

  function getMediaElement() {
    return document.querySelector("video");
  }

  function waitForMedia(timeoutMs = 10000) {
    return new Promise((resolve) => {
      const start = Date.now();
      const tick = () => {
        const media = getMediaElement();
        if (media && media.src) return resolve(media);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(tick, 200);
      };
      tick();
    });
  }

  function stopPlayback() {
    if (state.timer) {
      clearInterval(state.timer);
      state.timer = null;
    }
    const media = getMediaElement();
    if (media) {
      try {
        media.pause();
      } catch {}
    }
  }

  async function playCurrentEntry() {
    if (!state.entries.length) return;

    const entry = state.entries[state.currentIndex];
    if (!entry) return;

    const media = await waitForMedia();
    if (!media) {
      console.warn("Media element not ready");
      return;
    }

    try {
      media.currentTime = Math.max(0, entry.start || 0);
      media.play();
    } catch (e) {
      console.warn("Play error:", e);
    }

    if (state.timer) clearInterval(state.timer);

    state.timer = setInterval(() => {
      if (!state.isPlaying || !media) return;

      const end = Number(entry.end || 0);
      if (media.currentTime >= end) {
        clearInterval(state.timer);
        state.timer = null;

        const nextEntry = state.entries[state.currentIndex + 1];
        if (nextEntry) {
          const currentUrl = window.location.href;

          if (nextEntry.url && nextEntry.url !== currentUrl) {
            window.location.href = nextEntry.url;
            return;
          }

          state.currentIndex += 1;
          playCurrentEntry();
          return;
        }

        state.isPlaying = false;
        stopPlayback();
        updatePanel();
      }
    }, 300);
  }

  function updatePanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const btn = panel.querySelector(".ytm-pp-control-btn");
    if (btn) {
      btn.textContent = state.isPlaying ? "停止" : "連続再生開始";
    }
  }

  function renderPanel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const header = document.createElement("div");
    header.className = "ytm-pp-header";
    header.innerHTML = `
      <div class="ytm-pp-title">部分再生</div>
      <button class="ytm-pp-close" type="button">×</button>
    `;
    header.querySelector(".ytm-pp-close").addEventListener("click", () => {
      state.panelOpen = false;
      panel.classList.add("hidden");
    });

    const body = document.createElement("div");
    body.className = "ytm-pp-body";

    const list = document.createElement("div");
    list.className = "ytm-pp-list";

    state.entries.forEach((entry, idx) => {
      const item = document.createElement("div");
      item.className = "ytm-pp-item";

      const thumb = entry.thumbnail
        ? `<img class="ytm-pp-thumb" src="${entry.thumbnail}" alt="${entry.title}" />`
        : `<div class="ytm-pp-thumb" style="display:flex;align-items:center;justify-content:center;color:#fff;">♪</div>`;

      item.innerHTML = `
        ${thumb}
        <div class="ytm-pp-info">
          <div class="ytm-pp-item-title">${entry.title}</div>
          <div class="ytm-pp-item-artist">${entry.artist || "不明"}</div>
          <div class="ytm-pp-item-time">${formatSeconds(entry.start)}〜${formatSeconds(entry.end)}</div>
        </div>
        <button class="ytm-pp-play-btn" type="button" data-index="${idx}">再生</button>
      `;

      item.querySelector(".ytm-pp-play-btn").addEventListener("click", async () => {
        state.currentIndex = idx;
        state.isPlaying = true;
        updatePanel();
        await playCurrentEntry();
      });

      list.appendChild(item);
    });

    body.appendChild(list);

    const controlBtn = document.createElement("button");
    controlBtn.className = "ytm-pp-control-btn";
    controlBtn.type = "button";
    controlBtn.textContent = state.isPlaying ? "停止" : "連続再生開始";
    controlBtn.addEventListener("click", () => {
      if (state.isPlaying) {
        state.isPlaying = false;
        stopPlayback();
        controlBtn.textContent = "連続再生開始";
      } else {
        state.isPlaying = true;
        controlBtn.textContent = "停止";
        playCurrentEntry();
      }
    });

    body.appendChild(controlBtn);

    panel.innerHTML = "";
    panel.appendChild(header);
    panel.appendChild(body);
  }

  function createUi() {
    if (document.getElementById(BUTTON_ID)) return;

    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "部分再生";
    button.addEventListener("click", () => {
      const panel = document.getElementById(PANEL_ID);
      if (!panel) return;
      state.panelOpen = !state.panelOpen;
      if (state.panelOpen) {
        panel.classList.remove("hidden");
        renderPanel();
      } else {
        panel.classList.add("hidden");
      }
    });

    document.body.appendChild(button);

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.className = "hidden";
    document.body.appendChild(panel);
  }

  async function init() {
    await hydrateEntries();
    ensureStyle();
    createUi();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
