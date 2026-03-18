import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getDatabase, ref, push, query, orderByChild, limitToLast, get } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyByzQDytoBYzkw0kBaXlZ28ANMHmZogn4o",
  authDomain: "snake-abefb.firebaseapp.com",
  databaseURL: "https://snake-abefb-default-rtdb.firebaseio.com",
  projectId: "snake-abefb",
  storageBucket: "snake-abefb.firebasestorage.app",
  messagingSenderId: "72767029886",
  appId: "1:72767029886:web:13328bb141963117a00e2f",
  measurementId: "G-261Z1QTMZS"
};

const fbApp = initializeApp(firebaseConfig);
const db = getDatabase(fbApp);
const refs = {
  normal: ref(db, 'leaderboard'),
  expert: ref(db, 'leaderboard-expert')
};

let cache = { normal: [], expert: [] };

export async function fetchLeaderboard(mode = 'normal') {
  try {
    const q = query(refs[mode], orderByChild('score'), limitToLast(10));
    const snapshot = await get(q);
    const entries = [];
    snapshot.forEach(child => {
      entries.push(child.val());
    });
    entries.sort((a, b) => b.score - a.score);
    cache[mode] = entries;
    return entries;
  } catch (e) {
    console.error('Leaderboard fetch failed:', e);
    return cache[mode];
  }
}

export async function fetchAllLeaderboards() {
  await Promise.all([fetchLeaderboard('normal'), fetchLeaderboard('expert')]);
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderList(entries, colorClass) {
  if (!entries || entries.length === 0) {
    return '<p class="lb-empty">No scores yet. Be the first!</p>';
  }
  let html = `<ol class="lb-list ${colorClass}">`;
  entries.forEach((entry, i) => {
    const name = sanitize(entry.name || '???');
    html += `<li><span class="lb-rank">${i + 1}.</span><span class="lb-name">${name}</span><span class="lb-score">${entry.score}</span></li>`;
  });
  html += '</ol>';
  return html;
}

export function renderLeaderboard(containerId, activeTab = 'normal') {
  const container = document.getElementById(containerId);
  const normalActive = activeTab === 'normal' ? 'active' : '';
  const expertActive = activeTab === 'expert' ? 'active' : '';

  let html = `
    <h3>Top 10 Leaderboard</h3>
    <div class="lb-tabs">
      <button class="lb-tab lb-tab-normal ${normalActive}" data-tab="normal">Normal</button>
      <button class="lb-tab lb-tab-expert ${expertActive}" data-tab="expert">Expert</button>
    </div>
    <div class="lb-panel ${normalActive === 'active' ? '' : 'lb-hidden'}" data-panel="normal">
      ${renderList(cache.normal, 'lb-normal')}
    </div>
    <div class="lb-panel ${expertActive === 'active' ? '' : 'lb-hidden'}" data-panel="expert">
      ${renderList(cache.expert, 'lb-expert')}
    </div>
  `;
  container.innerHTML = html;

  // Tab click handlers
  container.querySelectorAll('.lb-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.lb-tab').forEach(t => t.classList.remove('active'));
      container.querySelectorAll('.lb-panel').forEach(p => p.classList.add('lb-hidden'));
      tab.classList.add('active');
      container.querySelector(`[data-panel="${tab.dataset.tab}"]`).classList.remove('lb-hidden');
      // Start auto-scroll on newly visible list
      const list = container.querySelector(`[data-panel="${tab.dataset.tab}"] .lb-list`);
      if (list && list.scrollHeight > list.clientHeight) {
        startAutoScroll(list);
      }
    });
  });

  // Auto-scroll active list
  const activeList = container.querySelector(`[data-panel="${activeTab}"] .lb-list`);
  if (activeList && activeList.scrollHeight > activeList.clientHeight) {
    startAutoScroll(activeList);
  }
}

let autoScrollTimers = [];

function startAutoScroll(list) {
  clearAutoScrolls();

  const WAIT_BEFORE_SCROLL = 2000;
  const SCROLL_SPEED = 0.5;
  const WAIT_AT_BOTTOM = 3000;

  let scrollInterval = null;

  const waitTimer = setTimeout(() => {
    scrollInterval = setInterval(() => {
      if (list.scrollTop + list.clientHeight >= list.scrollHeight - 1) {
        clearInterval(scrollInterval);
        const resetTimer = setTimeout(() => {
          list.scrollTo({ top: 0, behavior: 'smooth' });
          const restartTimer = setTimeout(() => {
            if (list.scrollHeight > list.clientHeight) {
              startAutoScroll(list);
            }
          }, 1500);
          autoScrollTimers.push(restartTimer);
        }, WAIT_AT_BOTTOM);
        autoScrollTimers.push(resetTimer);
      } else {
        list.scrollTop += SCROLL_SPEED;
      }
    }, 16);
    autoScrollTimers.push(scrollInterval);
  }, WAIT_BEFORE_SCROLL);

  autoScrollTimers.push(waitTimer);
  list.addEventListener('pointerdown', clearAutoScrolls, { once: true });
}

function clearAutoScrolls() {
  autoScrollTimers.forEach(id => {
    clearTimeout(id);
    clearInterval(id);
  });
  autoScrollTimers = [];
}

export function isTopTen(score, mode = 'normal') {
  const entries = cache[mode];
  if (entries.length < 10) return score > 0;
  return score > entries[entries.length - 1].score;
}

export async function submitScore(name, scoreVal, mode = 'normal') {
  const cleanName = name.replace(/[^a-zA-Z0-9_\- ]/g, '').slice(0, 7).trim();
  if (!cleanName || scoreVal <= 0) return;
  try {
    await push(refs[mode], {
      name: cleanName,
      score: scoreVal,
      ts: Date.now()
    });
    await fetchLeaderboard(mode);
  } catch (e) {
    console.error('Score submit failed:', e);
  }
}
