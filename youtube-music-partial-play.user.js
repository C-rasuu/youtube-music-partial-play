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
      .ytm-pp-playlist-container {
        padding: 16px;
      }

      .ytm-pp-playlist-header {
        display: flex;
        align-items: flex-end;
        gap: 16px;
        margin-bottom: 24px;
      }

      .ytm-pp-playlist-art {
        width: 150px;
        height: 150px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
      }

      .ytm-pp-playlist-info {
        flex: 1;
      }

      .ytm-pp-playlist-label {
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        text-transform: uppercase;
        letter-spacing: 0.1em;
        margin-bottom: 8px;
      }

      .ytm-pp-playlist-title {
        font-size: 32px;
        font-weight: 900;
        color: white;
        margin-bottom: 8px;
      }

      .ytm-pp-playlist-count {
        font-size: 14px;
        color: rgba(255,255,255,0.7);
      }

      .ytm-pp-playlist-controls {
        display: flex;
        gap: 8px;
        margin-top: 16px;
      }

      .ytm-pp-playlist-btn {
        background: #ff0033;
        color: white;
        border: none;
        border-radius: 24px;
        padding: 10px 30px;
        font-weight: 700;
        cursor: pointer;
        font-size: 14px;
      }

      .ytm-pp-playlist-btn:hover {
        background: #dd0031;
      }

      .ytm-pp-playlist-songs {
        margin-top: 24px;
      }

      .ytm-pp-song-item {
        display: grid;
        grid-template-columns: 56px 1fr auto;
        gap: 12px;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }

      .ytm-pp-song-item:last-child {
        border-bottom: none;
      }

      .ytm-pp-song-thumbnail {
        width: 56px;
        height: 56px;
        object-fit: cover;
        border-radius: 4px;
        background: #222;
      }

      .ytm-pp-song-info {
        min-width: 0;
      }

      .ytm-pp-song-title {
        font-size: 14px;
        font-weight: 500;
        color: white;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ytm-pp-song-artist {
        font-size: 12px;
        color: rgba(255,255,255,0.65);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .ytm-pp-song-time {
        font-size: 12px;
        color: rgba(255,255,255,0.65);
      }

      .ytm-pp-song-actions {
        display: flex;
        gap: 4px;
      }

      .ytm-pp-song-action-btn {
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.7);
        cursor: pointer;
        font-size: 18px;
        padding: 4px 8px;
      }

      .ytm-pp-song-action-btn:hover {
        color: white;
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

  function createPlaylistPage() {
    const container = document.createElement("div");
    container.className = "ytm-pp-playlist-container";

    // ヘッダー
    const header = document.createElement("div");
    header.className = "ytm-pp-playlist-header";
    header.innerHTML = `
      <div class="ytm-pp-playlist-art">🎵</div>
      <div class="ytm-pp-playlist-info">
        <div class="ytm-pp-playlist-label">プレイリスト</div>
        <div class="ytm-pp-playlist-title">部分再生</div>
        <div class="ytm-pp-playlist-count">${state.entries.length}曲</div>
        <div class="ytm-pp-playlist-controls">
          <button class="ytm-pp-playlist-btn" id="ytm-pp-play-all">すべて再生</button>
        </div>
      </div>
    `;

    const playAllBtn = header.querySelector("#ytm-pp-play-all");
    playAllBtn.addEventListener("click", () => {
      playEntryAtIndex(0);
    });

    container.appendChild(header);

    // 曲リスト
    const songsContainer = document.createElement("div");
    songsContainer.className = "ytm-pp-playlist-songs";

    state.entries.forEach((entry, idx) => {
      const songItem = document.createElement("div");
      songItem.className = "ytm-pp-song-item";

      const thumbnail = entry.thumbnail
        ? `<img src="${entry.thumbnail}" class="ytm-pp-song-thumbnail" alt="${entry.title}" />`
        : `<div class="ytm-pp-song-thumbnail" style="background: #222;">🎵</div>`;

      songItem.innerHTML = `
        ${thumbnail}
        <div class="ytm-pp-song-info">
          <div class="ytm-pp-song-title">${escapeHtml(entry.title)}</div>
          <div class="ytm-pp-song-artist">${escapeHtml(entry.artist)}</div>
        </div>
        <div>
          <div class="ytm-pp-song-time">${formatSeconds(entry.start)}–${formatSeconds(entry.end)}</div>
          <div class="ytm-pp-song-actions">
            <button class="ytm-pp-song-action-btn" data-index="${idx}" title="再生">▶</button>
          </div>
        </div>
      `;

      const playBtn = songItem.querySelector(".ytm-pp-song-action-btn");
      playBtn.addEventListener("click", () => {
        playEntryAtIndex(idx);
      });

      songsContainer.appendChild(songItem);
    });

    container.appendChild(songsContainer);

    return container;
  }

  function injectPlaylistPage() {
    // 既存の main content area を探す
    const mainArea = document.querySelector("ytmusic-responsive-page, [role='main'], main");
    
    if (!mainArea) {
      console.warn("Main content area not found");
      return;
    }

    // 既存のコンテンツをクリア
    const contentSections = mainArea.querySelectorAll("ytmusic-section-list-renderer, div[role='region']");
    
    if (contentSections.length > 0) {
      // コンテンツセクションをクリア
      contentSections.forEach(section => {
        section.style.display = "none";
      });
    } else {
      // フォールバック: メインのコンテンツをクリア
      const content = mainArea.querySelector("div");
      if (content) {
        content.innerHTML = "";
      }
    }

    // プレイリストページを挿入
    const playlistPage = createPlaylistPage();
    mainArea.appendChild(playlistPage);
  }

  function setupLibraryIntegration() {
    // ライブラリのリンクをクリックしたときにプレイリストを表示
    const libraryLink = document.querySelector('[href="/browse/library"], a[href*="library"]');
    
    if (libraryLink) {
      libraryLink.addEventListener("click", (e) => {
        // デフォルトの動作を少し遅延させて、ページ遷移後に注入
        setTimeout(() => {
          injectPlaylistPage();
        }, 500);
      });
    }

    // 現在のページがライブラリの場合も対応
    if (window.location.href.includes("/browse/library")) {
      setTimeout(() => {
        injectPlaylistPage();
      }, 1000);
    }
  }

  async function init() {
    await initializeEntries();
    ensureStyle();
    setupLibraryIntegration();

    // ページ遷移の監視
    const observer = new MutationObserver(() => {
      if (window.location.href.includes("/browse/library")) {
        const container = document.querySelector(".ytm-pp-playlist-container");
        if (!container) {
          injectPlaylistPage();
        }
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
