// ==UserScript==
// @name         Pixeldrain Key Remapper
// @namespace    https://github.com/hamzaharoon1314/Pixeldrain-Key-Remapper
// @version      1.5.2
// @description  Customize, disable, and import/export Pixeldrain keyboard shortcuts with a UI
// @author       Hamza Haroon
// @match        https://pixeldrain.com/*
// @match        https://pixeldrain.net/*
// @icon         https://pixeldrain.com/favicon.ico
// @homepageURL  https://github.com/hamzaharoon1314/Pixeldrain-Key-Remapper
// @supportURL   https://github.com/hamzaharoon1314/Pixeldrain-Key-Remapper/issues
// @downloadURL  https://raw.githubusercontent.com/hamzaharoon1314/Pixeldrain-Key-Remapper/main/script.js
// @updateURL    https://raw.githubusercontent.com/hamzaharoon1314/Pixeldrain-Key-Remapper/main/script.js
// @run-at       document-end
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════════════════════
     SHORTCUT DEFINITIONS
     All keyboard shortcuts found in file_viewer.js via keydown handler.
  ═══════════════════════════════════════════════════════════════════════════ */
  const SHORTCUTS = [
    { key: 'ArrowLeft',  label: 'Previous item',          category: 'Navigation' },
    { key: 'a',          label: 'Previous item (alt)',     category: 'Navigation' },
    { key: 'ArrowRight', label: 'Next item',              category: 'Navigation' },
    { key: 'd',          label: 'Next item (alt)',         category: 'Navigation' },
    { key: ' ',          label: 'Toggle playback',         category: 'Playback'   },
    { key: 'm',          label: 'Toggle mute',             category: 'Playback'   },
    { key: 'r',          label: 'Toggle repeat',           category: 'Playback'   },
    { key: 'h',          label: 'Seek −20 seconds',        category: 'Seek'       },
    { key: 'j',          label: 'Seek −5 seconds',         category: 'Seek'       },
    { key: 'k',          label: 'Seek +5 seconds',         category: 'Seek'       },
    { key: 'l',          label: 'Seek +20 seconds',        category: 'Seek'       },
    { key: ',',          label: 'Previous frame',          category: 'Seek'       },
    { key: '.',          label: 'Next frame',              category: 'Seek'       },
    { key: 's',          label: 'Download file',           category: 'File'       },
    { key: 'S',          label: 'Download list (Shift+S)', category: 'File'       },
    { key: 'c',          label: 'Copy link',               category: 'File'       },
    { key: 'u',          label: 'Pick files',              category: 'File'       },
    { key: 'i',          label: 'Toggle info panel',       category: 'UI'         },
    { key: 'e',          label: 'Toggle edit panel',       category: 'UI'         },
    { key: 'g',          label: 'Toggle fullscreen',       category: 'UI'         },
    { key: 'q',          label: 'Close window',            category: 'UI'         },
    { key: 'Escape',     label: 'Close modal / dialog',    category: 'UI'         },
  ];

  const CATEGORIES = ['Navigation', 'Playback', 'Seek', 'File', 'UI'];

  const CAT_META = {
    Navigation: { icon: '◈', color: '#60a5fa', glow: 'rgba(96,165,250,0.15)'  },
    Playback:   { icon: '◉', color: '#c084fc', glow: 'rgba(192,132,252,0.15)' },
    Seek:       { icon: '◀▶', color: '#34d399', glow: 'rgba(52,211,153,0.15)' },
    File:       { icon: '◫', color: '#fbbf24', glow: 'rgba(251,191,36,0.15)'  },
    UI:         { icon: '◻', color: '#f87171', glow: 'rgba(248,113,113,0.15)' },
  };

  /* ═══════════════════════════════════════════════════════════════════════════
     KEY DISPLAY
  ═══════════════════════════════════════════════════════════════════════════ */
  const KEY_DISPLAY = {
    ' ':        'SPACE',  'ArrowLeft':  '← LEFT',  'ArrowRight': '→ RIGHT',
    'ArrowUp':  '↑ UP',   'ArrowDown':  '↓ DOWN',  'Escape':     'ESC',
    'Enter':    'ENTER',  'Backspace':  'BKSP',     'Tab':        'TAB',
    'Delete':   'DEL',    'Home':       'HOME',     'End':        'END',
    'PageUp':   'PG UP',  'PageDown':   'PG DN',    'Insert':     'INS',
    ',':        ', (,)',   '.':          '. (.)',
    'F1':'F1','F2':'F2','F3':'F3','F4':'F4','F5':'F5','F6':'F6',
    'F7':'F7','F8':'F8','F9':'F9','F10':'F10','F11':'F11','F12':'F12',
  };
  const MODIFIER_KEYS = new Set([
    'Shift','Control','Alt','Meta','CapsLock','NumLock','ScrollLock','Dead','Unidentified'
  ]);

  function dk(key) {
    if (!key) return '—';
    return KEY_DISPLAY[key] || (key.length === 1 ? key.toUpperCase() : key);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     STORAGE  (originalKey → customKey)
  ═══════════════════════════════════════════════════════════════════════════ */
  const STORE_KEY  = 'pd_keyremap_v1';
  const ALL_ORIG   = new Set(SHORTCUTS.map(s => s.key));
  let   map        = {};

  function loadMap() {
    try { Object.assign(map, JSON.parse(GM_getValue(STORE_KEY, '{}'))) } catch (_) {}
    SHORTCUTS.forEach(s => { if (map[s.key] === undefined) map[s.key] = s.key; });
  }
  function saveMap()  { GM_setValue(STORE_KEY, JSON.stringify(map)); }
  function resetAll() { SHORTCUTS.forEach(s => { map[s.key] = s.key; }); saveMap(); }

  loadMap();

  // Reverse: customKey → originalKey  (first wins on collision)
  function revMap() {
    const r = {};
    for (const [orig, cust] of Object.entries(map)) if (!r[cust]) r[cust] = orig;
    return r;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CAPTURE STATE
  ═══════════════════════════════════════════════════════════════════════════ */
  let capturing      = false;
  let captureOrigKey = null;
  let captureBadge   = null;
  let captureRow     = null;

  function cancelCapture() {
    if (!capturing) return;
    if (captureBadge) {
      captureBadge.className = 'pkr-badge pkr-cust';
      captureBadge.textContent = dk(map[captureOrigKey]);
    }
    capturing = false; captureOrigKey = null; captureBadge = null; captureRow = null;
    status('Cancelled', 'dim');
  }

  function commitCapture(newKey) {
    if (newKey === null) return;
    map[captureOrigKey] = newKey;
    saveMap();
    const isModified = newKey !== captureOrigKey;
    captureBadge.className = 'pkr-badge pkr-cust pkr-saved';
    captureBadge.textContent = dk(newKey);
    captureRow.classList.toggle('pkr-modified', isModified);
    const lbl = SHORTCUTS.find(s => s.key === captureOrigKey)?.label || captureOrigKey;
    status(`✓  ${lbl}  →  ${dk(newKey)}`, 'ok');
    setTimeout(() => { if (captureBadge) captureBadge.className = 'pkr-badge pkr-cust'; }, 900);
    capturing = false; captureOrigKey = null; captureBadge = null; captureRow = null;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     KEY INTERCEPTION
  ═══════════════════════════════════════════════════════════════════════════ */
  let isSynth = false;
  let modalEl = null;

  document.addEventListener('keydown', e => {
    if (isSynth) return;
    if (e.ctrlKey || e.altKey || e.metaKey) return;

    /* — Close modal on Escape — */
    if (e.key === 'Escape' && modalEl && !capturing) {
      e.stopImmediatePropagation();
      e.preventDefault();
      closeModal();
      return;
    }

    /* — Key capture mode — */
    if (capturing) {
      // If focus moved to search, cancel silently
      if (document.activeElement && document.activeElement.id === 'pkr-search') {
        cancelCapture(); return;
      }
      e.stopImmediatePropagation();
      e.preventDefault();
      if (MODIFIER_KEYS.has(e.key)) return;       // wait for real key
      if (e.key === 'Escape') { cancelCapture(); return; }

      // Conflict check
      const conflict = SHORTCUTS.find(s => s.key !== captureOrigKey && map[s.key] === e.key);
      if (conflict) {
        captureBadge.className = 'pkr-badge pkr-cust pkr-conflict';
        captureBadge.textContent = '✕ TAKEN';
        status(`"${dk(e.key)}" already bound to: ${conflict.label}`, 'err');
        setTimeout(() => {
          if (capturing && captureBadge) {
            captureBadge.className = 'pkr-badge pkr-cust pkr-capturing';
            captureBadge.textContent = 'PRESS KEY';
            status('Try a different key  ·  Esc to cancel', 'warn');
          }
        }, 1600);
        return;
      }
      commitCapture(e.key);
      return;
    }

    /* — Skip text inputs — */
    const el = document.activeElement;
    if (el) {
      const tag  = el.tagName;
      const type = (el.type || '').toLowerCase();
      if (tag === 'TEXTAREA' || (tag === 'INPUT' &&
          ['text','email','search','number','password','url'].includes(type))) return;
    }

    /* — Remap logic — */
    const rm   = revMap();
    const orig = rm[e.key];

    // 🔴 If key is disabled → block it
    if (orig !== undefined && map[orig] === null) {
    e.stopImmediatePropagation();
    e.preventDefault();
    return;
    }

    if (orig !== undefined && orig !== e.key) {
    // Custom key pressed → fire original
    e.stopImmediatePropagation();
    e.preventDefault();
    isSynth = true;
    (e.target || document.body).dispatchEvent(new KeyboardEvent('keydown', {
        key: orig, bubbles: true, cancelable: true, shiftKey: orig === 'S',
    }));
    isSynth = false;
    }
    else if (orig === e.key) {
    // Identity mapping → let through
    }
    else if (ALL_ORIG.has(e.key) && map[e.key] !== e.key) {
    // Original key remapped OR disabled → block
    e.stopImmediatePropagation();
    }
  }, true);

  /* ═══════════════════════════════════════════════════════════════════════════
     STYLES
  ═══════════════════════════════════════════════════════════════════════════ */
  const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Mono:wght@400;500&display=swap');

    #pkr-fab {
      position: fixed; bottom: 22px; right: 22px; z-index: 2147483647;
      width: 48px; height: 48px; border-radius: 14px;
      background: #0f1117;
      border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; font-size: 22px;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 0 1px rgba(96,165,250,0.15), 0 8px 24px rgba(0,0,0,0.5);
      transition: transform .2s cubic-bezier(.34,1.56,.64,1), box-shadow .2s, border-color .2s;
      user-select: none;
    }
    #pkr-fab:hover {
      transform: scale(1.1) rotate(-8deg);
      border-color: rgba(96,165,250,0.5);
      box-shadow: 0 0 0 1px rgba(96,165,250,0.3), 0 8px 32px rgba(0,0,0,0.6), 0 0 20px rgba(96,165,250,0.12);
    }
    #pkr-fab-dot {
      position: absolute; top: 6px; right: 6px;
      width: 8px; height: 8px; border-radius: 50%;
      background: #60a5fa;
      box-shadow: 0 0 6px rgba(96,165,250,0.8);
      display: none;
    }
    #pkr-fab-dot.active { display: block; }

    #pkr-overlay {
      position: fixed; inset: 0;
      background: rgba(5,6,10,0.82);
      backdrop-filter: blur(10px) saturate(0.7);
      z-index: 2147483646;
      display: flex; align-items: center; justify-content: center;
      animation: pkrFadeIn .18s ease;
    }
    @keyframes pkrFadeIn { from { opacity:0 } to { opacity:1 } }

    #pkr-panel {
      width: 700px; max-width: calc(100vw - 32px); max-height: calc(100vh - 48px);
      background: #0b0d14;
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 20px;
      display: flex; flex-direction: column; overflow: hidden;
      box-shadow:
        0 0 0 1px rgba(96,165,250,0.05),
        0 40px 80px rgba(0,0,0,0.75),
        inset 0 1px 0 rgba(255,255,255,0.04);
      animation: pkrSlideUp .28s cubic-bezier(.34,1.56,.64,1);
      font-family: 'Syne', system-ui, sans-serif;
    }
    @keyframes pkrSlideUp {
      from { transform: translateY(40px) scale(.95); opacity:0 }
      to   { transform: none; opacity:1 }
    }

    /* ── Header ── */
    #pkr-header {
      padding: 22px 26px 18px;
      border-bottom: 1px solid rgba(255,255,255,0.045);
      display: flex; align-items: center; gap: 16px; flex-shrink: 0;
    }
    #pkr-logo {
      width: 46px; height: 46px; border-radius: 13px; flex-shrink: 0;
      background: linear-gradient(135deg,rgba(96,165,250,0.12) 0%,rgba(192,132,252,0.12) 100%);
      border: 1px solid rgba(96,165,250,0.18);
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    #pkr-header-text { flex: 1; min-width: 0; }
    #pkr-title {
      font-size: 18px; font-weight: 800; color: #f1f5f9;
      letter-spacing: -0.5px; line-height: 1.1;
    }
    #pkr-subtitle { font-size: 12px; color: #3f4860; margin-top: 4px; font-weight: 600; letter-spacing: .3px; }
    #pkr-close {
      width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
      background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.07);
      color: #4b5563; cursor: pointer; font-size: 15px;
      display: flex; align-items: center; justify-content: center;
      transition: background .15s, color .15s, border-color .15s;
    }
    #pkr-close:hover { background: rgba(248,113,113,.13); color: #f87171; border-color: rgba(248,113,113,.2); }

    /* ── Body ── */
    #pkr-body {
      flex: 1; overflow-y: auto; padding: 18px 22px;
      scrollbar-width: thin; scrollbar-color: rgba(255,255,255,.06) transparent;
    }
    #pkr-body::-webkit-scrollbar { width: 5px; }
    #pkr-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,.06); border-radius: 3px; }

    #pkr-search-wrap {
      position: relative; margin-bottom: 18px;
    }
    #pkr-search-icon {
      position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
      color: #2d3348; font-size: 14px; pointer-events: none;
    }
    #pkr-search {
      width: 100%; box-sizing: border-box;
      background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06);
      border-radius: 11px; padding: 10px 14px 10px 36px;
      color: #c9d1e8; font-size: 13px; font-family: inherit; font-weight: 600;
      outline: none; transition: border-color .15s, background .15s;
    }
    #pkr-search::placeholder { color: #2d3348; }
    #pkr-search:focus {
      border-color: rgba(96,165,250,0.3);
      background: rgba(96,165,250,0.03);
    }

    /* ── Section ── */
    .pkr-section { margin-bottom: 20px; }
    .pkr-sec-hdr {
      display: flex; align-items: center; gap: 8px;
      padding: 6px 10px 6px 0; margin-bottom: 6px;
    }
    .pkr-sec-dot {
      width: 6px; height: 6px; border-radius: 2px; flex-shrink: 0;
    }
    .pkr-sec-icon { font-size: 13px; }
    .pkr-sec-name {
      font-size: 10.5px; font-weight: 800; letter-spacing: 1.4px; text-transform: uppercase;
    }
    .pkr-sec-count { margin-left: auto; font-size: 10px; color: #1e2433; font-weight: 600; }

    /* ── Row ── */
    .pkr-row {
      display: grid;
      grid-template-columns: 1fr 90px 16px 90px 28px;
      align-items: center; gap: 8px;
      padding: 7px 10px; border-radius: 10px;
      transition: background .12s; border: 1px solid transparent;
    }
    .pkr-row:hover { background: rgba(255,255,255,.022); }
    .pkr-row.pkr-modified {
      background: rgba(96,165,250,.04);
      border-color: rgba(96,165,250,.07);
    }

    .pkr-label {
      font-size: 13px; color: #8b96b8; font-weight: 600;
      overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    }
    .pkr-modified .pkr-label { color: #7eb3fb; }

    .pkr-arrow { color: #1e2433; font-size: 12px; text-align: center; font-weight: 700; }

    /* ── Badges ── */
    .pkr-badge {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 5px 8px; border-radius: 8px;
      font-size: 10.5px; font-weight: 500; letter-spacing: .6px;
      font-family: 'DM Mono', 'Fira Code', 'Cascadia Code', ui-monospace, monospace;
      white-space: nowrap; width: 100%; box-sizing: border-box; text-align: center;
      transition: all .15s;
    }
    .pkr-orig {
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.05);
      color: #2d3a50;
    }
    .pkr-modified .pkr-orig { text-decoration: line-through; color: #1e2733; }

    .pkr-cust {
      background: rgba(96,165,250,.08); border: 1px solid rgba(96,165,250,.16);
      color: #7eb3fb; cursor: pointer;
    }
    .pkr-cust:hover {
      background: rgba(96,165,250,.15); border-color: rgba(96,165,250,.35);
      color: #bfdbfe; transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(96,165,250,.12);
    }
    .pkr-cust.pkr-capturing {
      background: rgba(251,191,36,.08); border-color: rgba(251,191,36,.35);
      color: #fcd34d;
      animation: pkrPulse 1.1s ease-in-out infinite;
    }
    @keyframes pkrPulse {
      0%,100% { box-shadow: 0 0 0 0 rgba(251,191,36,0.25) }
      50%      { box-shadow: 0 0 0 7px rgba(251,191,36,0) }
    }
    .pkr-cust.pkr-conflict {
      background: rgba(248,113,113,.1); border-color: rgba(248,113,113,.35);
      color: #fca5a5;
      animation: pkrShake .4s ease;
    }
    @keyframes pkrShake {
      0%,100% { transform:none } 20% { transform:translateX(-5px) }
      60%      { transform:translateX(5px) }  80% { transform:translateX(-2px) }
    }
    .pkr-cust.pkr-saved {
      background: rgba(52,211,153,.1); border-color: rgba(52,211,153,.3);
      color: #6ee7b7;
    }

    .pkr-rst {
      width: 26px; height: 26px; border-radius: 7px;
      background: transparent; border: 1px solid transparent;
      color: #1e2433; cursor: pointer; font-size: 14px;
      display: flex; align-items: center; justify-content: center;
      transition: all .15s; opacity: 0;
    }
    .pkr-row:hover .pkr-rst,
    .pkr-modified .pkr-rst { opacity: 1; color: #3f4860; }
    .pkr-rst:hover { background: rgba(255,255,255,.06); color: #8b96b8; border-color: rgba(255,255,255,.07); }

    /* ── Footer ── */
    #pkr-footer {
      padding: 14px 22px; flex-shrink: 0;
      border-top: 1px solid rgba(255,255,255,.04);
      display: flex; align-items: center; gap: 10px;
    }
    #pkr-status {
      flex: 1; font-size: 12px; font-weight: 600;
      color: #2d3348; text-align: center;
      transition: color .2s; letter-spacing: .2px;
    }
    .pkr-btn {
      padding: 8px 16px; border-radius: 9px; font-size: 12px; font-weight: 700;
      cursor: pointer; transition: all .15s; letter-spacing: .4px;
      font-family: inherit;
    }
    .pkr-btn-ghost {
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.07);
      color: #4b5563;
    }
    .pkr-btn-ghost:hover { background: rgba(255,255,255,.07); color: #94a3b8; }
    .pkr-btn-danger {
      background: rgba(248,113,113,.07); border: 1px solid rgba(248,113,113,.14);
      color: #f87171;
    }
    .pkr-btn-danger:hover { background: rgba(248,113,113,.14); border-color: rgba(248,113,113,.28); color: #fca5a5; }

    /* ── No results ── */
    #pkr-empty {
      text-align: center; padding: 40px 20px;
      color: #1e2433; font-size: 13px; font-weight: 600; display: none;
    }
  `;

  /* ═══════════════════════════════════════════════════════════════════════════
     STATUS BAR
  ═══════════════════════════════════════════════════════════════════════════ */
  const STATUS_COLORS = { ok: '#34d399', err: '#f87171', warn: '#fbbf24', dim: '#2d3348' };
  let statusTimer = null;

  function status(msg, type = 'dim') {
    const el = document.getElementById('pkr-status');
    if (!el) return;
    el.style.color = STATUS_COLORS[type] || STATUS_COLORS.dim;
    el.textContent = msg;
    clearTimeout(statusTimer);
    if (type !== 'dim') {
      statusTimer = setTimeout(() => {
        el.style.color = STATUS_COLORS.dim;
        el.textContent = 'Click any key badge to remap it';
      }, 2600);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
// IMPORT / EXPORT
// ═══════════════════════════════════════════════════════════════════════════

// Export mapping to file
function exportConfig() {
  const dataStr = JSON.stringify(map, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });

  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'pixeldrain-keymap.json';
  a.click();

  status('Exported keymap ✓', 'ok');
}

// Import mapping from file
function importConfig(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const imported = JSON.parse(e.target.result);

      // Validate keys
      for (const k of Object.keys(imported)) {
        if (!ALL_ORIG.has(k)) continue;
        map[k] = imported[k];
      }

      saveMap();
      refreshUI();
      updateFabDot();

      status('Imported keymap ✓', 'ok');
    } catch (err) {
      status('Invalid JSON file ✕', 'err');
    }
  };

  reader.readAsText(file);
}


  /* ═══════════════════════════════════════════════════════════════════════════
     BUILD UI
  ═══════════════════════════════════════════════════════════════════════════ */
  function init() {
    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = CSS;
    document.head.appendChild(styleEl);

    // Floating action button
    const fab = document.createElement('button');
    fab.id = 'pkr-fab';
    fab.title = 'Key Remapper — Click to open';
    fab.innerHTML = '⌨️<span id="pkr-fab-dot"></span>';
    fab.addEventListener('click', openModal);
    document.body.appendChild(fab);

    // Update dot indicator if any key is remapped
    updateFabDot();

    // Register Tampermonkey menu command
    GM_registerMenuCommand('⌨️ Open Key Remapper', openModal);
  }

  function updateFabDot() {
    const dot = document.getElementById('pkr-fab-dot');
    if (!dot) return;
    const hasRemap = SHORTCUTS.some(s => map[s.key] !== s.key);
    dot.className = hasRemap ? 'active' : '';
  }

  function refreshUI() {
  document.querySelectorAll('.pkr-row').forEach(row => {
    const k = row.dataset.key;
    if (!k) return;

    const b = row.querySelector('.pkr-cust');

    if (map[k] === null) {
      b.textContent = 'DISABLED';
      b.className = 'pkr-badge pkr-cust pkr-conflict';
      row.classList.add('pkr-modified');
    } else {
      b.textContent = dk(map[k]);
      b.className = 'pkr-badge pkr-cust';
      row.classList.toggle('pkr-modified', map[k] !== k);
    }
  });
}

  /* ═══════════════════════════════════════════════════════════════════════════
     MODAL
  ═══════════════════════════════════════════════════════════════════════════ */
  function openModal() {
    if (modalEl) { closeModal(true); return; }

    const overlay = document.createElement('div');
    overlay.id = 'pkr-overlay';
    overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

    const panel = document.createElement('div');
    panel.id = 'pkr-panel';
    panel.addEventListener('click', e => e.stopPropagation());

    /* Header */
    const hdr = document.createElement('div');
    hdr.id = 'pkr-header';
    hdr.innerHTML = `
      <div id="pkr-logo">⌨️</div>
      <div id="pkr-header-text">
        <div id="pkr-title">Key Remapper</div>
        <div id="pkr-subtitle">PIXELDRAIN · ${SHORTCUTS.length} SHORTCUTS · CHANGES SAVE INSTANTLY</div>
      </div>
      <button id="pkr-close" title="Close  (Esc)">✕</button>
    `;
    hdr.querySelector('#pkr-close').addEventListener('click', () => closeModal());

    /* Body */
    const body = document.createElement('div');
    body.id = 'pkr-body';

    /* Search */
    const searchWrap = document.createElement('div');
    searchWrap.id = 'pkr-search-wrap';
    searchWrap.innerHTML = '<span id="pkr-search-icon">⌕</span>';
    const searchInput = document.createElement('input');
    searchInput.id = 'pkr-search';
    searchInput.type = 'text';
    searchInput.placeholder = 'Search shortcuts…';
    searchInput.addEventListener('input', () => filterRows(searchInput.value));
    searchWrap.appendChild(searchInput);
    body.appendChild(searchWrap);

    /* Column header */
    const colHdr = document.createElement('div');
    colHdr.style.cssText = `
      display:grid; grid-template-columns:1fr 90px 16px 90px 28px; gap:8px;
      padding:0 10px 8px; font-size:9.5px; font-weight:800; letter-spacing:1.2px;
      color:#1e2433; text-transform:uppercase;
    `;
    colHdr.innerHTML = `
      <span>Action</span><span style="text-align:center">Default</span>
      <span></span><span style="text-align:center">Custom</span><span></span>
    `;
    body.appendChild(colHdr);

    /* Sections */
    CATEGORIES.forEach(cat => {
      const shortcuts = SHORTCUTS.filter(s => s.category === cat);
      const meta = CAT_META[cat];

      const sec = document.createElement('div');
      sec.className = 'pkr-section';
      sec.dataset.cat = cat;

      const secHdr = document.createElement('div');
      secHdr.className = 'pkr-sec-hdr';
      secHdr.innerHTML = `
        <div class="pkr-sec-dot" style="background:${meta.color};box-shadow:0 0 6px ${meta.color}55"></div>
        <span class="pkr-sec-icon">${meta.icon}</span>
        <span class="pkr-sec-name" style="color:${meta.color}">${cat}</span>
        <span class="pkr-sec-count">${shortcuts.length} KEY${shortcuts.length > 1 ? 'S' : ''}</span>
      `;
      sec.appendChild(secHdr);

      shortcuts.forEach(s => sec.appendChild(buildRow(s)));
      body.appendChild(sec);
    });

    /* Empty state */
    const empty = document.createElement('div');
    empty.id = 'pkr-empty';
    empty.textContent = 'No shortcuts found.';
    body.appendChild(empty);

    /* Footer */
    const footer = document.createElement('div');
    footer.id = 'pkr-footer';

    // Import button
    const importBtn = document.createElement('button');
    importBtn.className = 'pkr-btn pkr-btn-ghost';
    importBtn.textContent = 'IMPORT';

    importBtn.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';

      input.onchange = e => {
        const file = e.target.files[0];
        if (file) importConfig(file);
      };

      input.click();
    });

    // Export button
    const exportBtn = document.createElement('button');
    exportBtn.className = 'pkr-btn pkr-btn-ghost';
    exportBtn.textContent = 'EXPORT';
    exportBtn.addEventListener('click', exportConfig);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'pkr-btn pkr-btn-danger';
    resetBtn.textContent = '↺  RESET ALL';
    resetBtn.addEventListener('click', doResetAll);

    const statusEl = document.createElement('span');
    statusEl.id = 'pkr-status';
    statusEl.textContent = 'Click any key badge to remap it';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'pkr-btn pkr-btn-ghost';
    closeBtn.textContent = 'CLOSE';
    closeBtn.addEventListener('click', () => closeModal());

    footer.appendChild(importBtn);
    footer.appendChild(exportBtn);
    footer.appendChild(resetBtn);
    footer.appendChild(statusEl);
    footer.appendChild(closeBtn);

    panel.appendChild(hdr);
    panel.appendChild(body);
    panel.appendChild(footer);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
    modalEl = overlay;

    setTimeout(() => searchInput.focus(), 80);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     ROW BUILDER
  ═══════════════════════════════════════════════════════════════════════════ */
  function buildRow(s) {
    const { key, label } = s;
    const isModified = map[key] !== key;

    const row = document.createElement('div');
    row.className = 'pkr-row' + (isModified ? ' pkr-modified' : '');
    row.dataset.key = key;
    row.dataset.label = label.toLowerCase();

    const lbl = document.createElement('div');
    lbl.className = 'pkr-label';
    lbl.title = label;
    lbl.textContent = label;

    const origBadge = document.createElement('span');
    origBadge.className = 'pkr-badge pkr-orig';
    origBadge.textContent = dk(key);
    origBadge.title = 'Default key';

    const arrow = document.createElement('div');
    arrow.className = 'pkr-arrow';
    arrow.textContent = '→';

    const custBadge = document.createElement('span');
    custBadge.className = 'pkr-badge pkr-cust';
    custBadge.textContent = map[key] === null ? 'DISABLED' : dk(map[key]);
    custBadge.title = 'Click to remap';
    custBadge.addEventListener('click', () => {
      if (capturing && captureOrigKey === key) { cancelCapture(); return; }
      startCapture(key, custBadge, row);
    });

    const rstBtn = document.createElement('button');
    rstBtn.className = 'pkr-rst';
    rstBtn.title = 'Reset to default';
    rstBtn.textContent = '↺';
    rstBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (capturing && captureOrigKey === key) cancelCapture();
      map[key] = key;
      saveMap();
      custBadge.textContent = dk(key);
      custBadge.className = 'pkr-badge pkr-cust';
      row.classList.remove('pkr-modified');
      updateFabDot();
      status(`Reset: ${label}`, 'dim');
    });

    const disableBtn = document.createElement('button');
    disableBtn.className = 'pkr-rst';
    disableBtn.title = 'Disable shortcut';
    disableBtn.textContent = '✕';

    disableBtn.addEventListener('click', e => {
    e.stopPropagation();
    map[key] = null;
    saveMap();

    custBadge.textContent = 'DISABLED';
    custBadge.className = 'pkr-badge pkr-cust pkr-conflict';

    row.classList.add('pkr-modified');
    updateFabDot();
    status(`Disabled: ${label}`, 'warn');
    });

    row.append(lbl, origBadge, arrow, custBadge, rstBtn, disableBtn);
    return row;
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CAPTURE
  ═══════════════════════════════════════════════════════════════════════════ */
  function startCapture(origKey, badgeEl, rowEl) {
    if (capturing) cancelCapture();
    capturing = true;
    captureOrigKey = origKey;
    captureBadge = badgeEl;
    captureRow = rowEl;

    badgeEl.className = 'pkr-badge pkr-cust pkr-capturing';
    badgeEl.textContent = 'PRESS KEY';
    status('Press any key  ·  Esc to cancel', 'warn');
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     RESET ALL
  ═══════════════════════════════════════════════════════════════════════════ */
  function doResetAll() {
    if (capturing) cancelCapture();
    resetAll();
    document.querySelectorAll('.pkr-row').forEach(row => {
      const k = row.dataset.key;
      if (!k) return;
      const b = row.querySelector('.pkr-cust');
      if (b) { b.textContent = dk(k); b.className = 'pkr-badge pkr-cust'; }
      row.classList.remove('pkr-modified');
    });
    updateFabDot();
    status('All shortcuts restored to defaults  ✓', 'ok');
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     FILTER
  ═══════════════════════════════════════════════════════════════════════════ */
  function filterRows(q) {
    q = q.toLowerCase().trim();
    let totalVisible = 0;

    document.querySelectorAll('.pkr-row').forEach(row => {
      const show = !q
        || (row.dataset.label || '').includes(q)
        || dk(row.dataset.key || '').toLowerCase().includes(q)
        || (row.dataset.key || '').toLowerCase().includes(q);
      row.style.display = show ? '' : 'none';
      if (show) totalVisible++;
    });

    document.querySelectorAll('.pkr-section').forEach(sec => {
      const vis = [...sec.querySelectorAll('.pkr-row')].some(r => r.style.display !== 'none');
      sec.style.display = vis ? '' : 'none';
    });

    const empty = document.getElementById('pkr-empty');
    if (empty) empty.style.display = totalVisible === 0 ? 'block' : 'none';
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     CLOSE MODAL
  ═══════════════════════════════════════════════════════════════════════════ */
  function closeModal(instant = false) {
    if (capturing) cancelCapture();
    if (!modalEl) return;
    if (instant) { modalEl.remove(); modalEl = null; updateFabDot(); return; }
    modalEl.style.animation = 'pkrFadeIn .15s ease reverse';
    const panel = modalEl.querySelector('#pkr-panel');
    if (panel) panel.style.animation = 'pkrSlideUp .15s ease reverse';
    setTimeout(() => { if (modalEl) { modalEl.remove(); modalEl = null; updateFabDot(); } }, 150);
  }

  /* ═══════════════════════════════════════════════════════════════════════════
     BOOT
  ═══════════════════════════════════════════════════════════════════════════ */
  if (document.body) init();
  else window.addEventListener('DOMContentLoaded', init);

})();
