import { START_DATE, STORAGE_PREFIX } from './config.js';
import { dateKeyLocal, daysBetween } from './utils.js';

const storagePrefix = STORAGE_PREFIX;

const monthNames = [
  'Január','Február','Március','Április','Május','Június',
  'Július','Augusztus','Szeptember','Október','November','December'
];

let current = new Date();
let displayedMonth = current.getMonth();
let displayedYear = current.getFullYear();

const calendarGrid = document.getElementById('calendarGrid');
const monthNameEl = document.getElementById('monthName');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');

/* ---- badge DOM ---- */
const monthlyBadgeArea = document.getElementById("monthlyBadgeArea");
const badgeIcon = document.getElementById("badgeIcon");
const badgeText = document.getElementById("badgeText");

const badgeDialog = document.getElementById("badgeDialog");
const badgeClose = document.getElementById("badgeClose");

const badgeRevealWrap = document.getElementById("badgeRevealWrap");
const badgeRevealIcon = document.getElementById("badgeRevealIcon");
const badgeRevealTitle = document.getElementById("badgeRevealTitle");

const statFav = document.getElementById("statFav");
const statHate = document.getElementById("statHate");
const statFast = document.getElementById("statFast");
const statCongrats = document.getElementById("statCongrats");

/* ---------- helpers ---------- */

function sleep(ms) {
  return new Promise(res => setTimeout(res, ms));
}

function getMonthKey(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

function getDayState(dateObj) {
  const key = dateKeyLocal(dateObj);
  return safeParse(localStorage.getItem(storagePrefix + key));
}

function isGreenDay(state) {
  return !!(state && state.done && state.guesses?.includes(state.target));
}

function isPlayedDay(state) {
  return !!state && state.done;
}

function isDayInPlayableRange(d) {
  const dayIndex = daysBetween(d, START_DATE);
  const todayIndex = daysBetween(new Date(), START_DATE);
  return dayIndex >= 0 && dayIndex <= todayIndex;
}

function getBadgeTier(greenDays, playableDays) {
  if (playableDays <= 0) return "wood";

  const ratio = greenDays / playableDays;

  if (ratio >= 1) return "gold";        // 100%
  if (ratio >= 2 / 3) return "silver";  // 66.6%
  if (ratio >= 1 / 3) return "bronze";  // 33.3%
  return "wood";
}

function tierLabel(tier) {
  if (tier === "gold") return "Arany jelvény";
  if (tier === "silver") return "Ezüst jelvény";
  if (tier === "bronze") return "Bronz jelvény";
  return "Kaki jelvény";
}

function tierClass(tier) {
  return `badge-tier-${tier}`;
}

function clearStats() {
  for (const el of [statFav, statHate, statFast, statCongrats]) {
    el.classList.add("hidden");
    el.classList.remove("show");
    el.classList.remove("scrambling");
    el.classList.remove("scramble-done");
    el.textContent = "";
  }
}

async function revealCongratsText(el, text, delayMs = 450) {
  await sleep(delayMs);
  el.textContent = text;
  el.classList.remove("hidden");
  requestAnimationFrame(() => el.classList.add("show"));
}


const CONGRATS_TEXTS = [
  "Az igen!",
  "Nem semmi!",
  "Bitang veszélyes vagy!",
  "Kratulálog!",
  "Hát ez marhajó!",
  "Még egy ilyet...",
  "Aztamindenségit!",
  "Nagy szónok vagy!",
  "Nagyot szólt!",
  "Na ezt nem láttuk jönni.",
  "Hát ez kész...",
  "Nadon jó, nadon jó, nadon jó!",
  "Na de milyen a chilis?"
];

function pickRandomCongrats() {
  return CONGRATS_TEXTS[Math.floor(Math.random() * CONGRATS_TEXTS.length)];
}


/* ---------- goofy cipher scramble reveal ---------- */

function randomCipherChar() {
  const chars = "█▓▒░#@&%$!?*+=<>/\\|~^";
  return chars[Math.floor(Math.random() * chars.length)];
}

function scrambleLikeText(text, progress) {
  if (!text) return "—";

  const keepCount = Math.floor(text.length * progress);
  let out = "";

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (i < keepCount) out += ch;
    else out += (ch === " " ? " " : randomCipherChar());
  }

  return out;
}

async function typeInText(el, text, charDelay = 28) {
  el.textContent = "";
  for (let i = 0; i < text.length; i++) {
    el.textContent += text[i];
    await sleep(charDelay);
  }
}

async function scrambleInText(el, finalText, steps = 26, stepDelay = 55) {
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    el.textContent = scrambleLikeText(finalText, t);
    await sleep(stepDelay);
  }
  el.textContent = finalText;
}

async function revealStatLabelThenScrambleWord(el, labelText, wordText, delayMs) {
  await sleep(delayMs);

  el.classList.remove("hidden");
  el.classList.add("show");
  el.classList.add("scrambling");

  // 1) label typed in normally
  await typeInText(el, labelText, 24);

  // 2) scramble ONLY the word after ": "
  const wordSpan = document.createElement("span");
  wordSpan.textContent = "";
  el.appendChild(wordSpan);

  await scrambleInText(wordSpan, wordText || "—", 26, 55);

  el.classList.remove("scrambling");
  el.classList.add("scramble-done");
}

/* ---------- compute monthly stats ---------- */

function collectMonthData(month, year) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthEnd = new Date(year, month, daysInMonth);
  monthEnd.setHours(0, 0, 0, 0);

  // month is complete only if we reached the last day (or later)
  const isMonthComplete = daysBetween(today, monthEnd) >= 0;

  let playableDaysSoFar = 0;      // days in month that are playable up to today
  let playableDaysFullMonth = 0;  // all playable days in that month (ignoring today cutoff)

  let playedDays = 0;
  let greenDays = 0;

  const entries = [];

  const todayIndex = daysBetween(today, START_DATE);

  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    d.setHours(0, 0, 0, 0);

    const dayIndex = daysBetween(d, START_DATE);

    // before game start → not a playable day ever
    if (dayIndex < 0) continue;

    // this day counts as part of the full month challenge
    playableDaysFullMonth++;

    // playable "so far" (for progress / tier calculations)
    if (dayIndex <= todayIndex) {
      playableDaysSoFar++;
    }

    const state = getDayState(d);

    if (isPlayedDay(state)) playedDays++;
    if (isGreenDay(state)) greenDays++;

    if (state) {
      entries.push({
        date: d,
        key: dateKeyLocal(d),
        state
      });
    }
  }

  // badge earnable only if month is complete AND all full-month playable days were played
  const completedAllDays =
    playableDaysFullMonth > 0 &&
    isMonthComplete &&
    playedDays === playableDaysFullMonth;

  return {
    daysInMonth,

    playableDays: playableDaysSoFar, // keep your existing name so you don’t need refactors
    playableDaysSoFar,
    playableDaysFullMonth,

    playedDays,
    greenDays,

    isMonthComplete,
    completedAllDays,

    entries
  };
}

function computeMonthlyWordStats(entries) {
  const scored = [];

  for (const e of entries) {
    const s = e.state;
    const word = s?.target;
    if (!word) continue;

    // USER rating (player rating)
	const playerScore = s.playerScore != null ? Number(s.playerScore) : null;

    const guessesCount = Array.isArray(s.guesses) ? s.guesses.length : null;

    scored.push({
      word,
      playerScore,
      guessesCount,
      green: isGreenDay(s),
      done: !!s.done
    });
  }

  // pools
  const rated = scored.filter(x => x.playerScore !== null && x.guessesCount !== null);

  // ---------- FAVORITE ----------
  // highest playerScore
  // tie-break:
  //  1) prefer green
  //  2) least guesses
  let favoriteWord = null;

  if (rated.length) {
    const maxScore = Math.max(...rated.map(x => x.playerScore));
	
    const topRated = rated.filter(x => x.playerScore === maxScore);
    const topRatedGreen = topRated.filter(x => x.green);
    const favPool = topRatedGreen.length ? topRatedGreen : topRated;

    favoriteWord = favPool
      .slice()
      .sort((a, b) => a.guessesCount - b.guessesCount)[0].word;
  }

  // ---------- WORST ----------
  // lowest playerScore
  // tie-break:
  //  1) prefer NOT green
  //  2) most guesses
  let hatedWord = null;

  if (rated.length) {
    const minScore = Math.min(...rated.map(x => x.playerScore));

    const bottomRated = rated.filter(x => x.playerScore === minScore);

    const bottomRatedNonGreen = bottomRated.filter(x => !x.green);
    const hatePool = bottomRatedNonGreen.length ? bottomRatedNonGreen : bottomRated;

    hatedWord = hatePool
      .slice()
      .sort((a, b) => b.guessesCount - a.guessesCount)[0].word;
  }

  // ---------- FASTEST ----------
  // least guesses among GREEN solved words
  let fastestWord = null;

  const greenSolved = scored.filter(x => x.green && x.guessesCount !== null);
  if (greenSolved.length) {
    fastestWord = greenSolved
      .slice()
      .sort((a, b) => a.guessesCount - b.guessesCount)[0].word;
  }

  return { favoriteWord, hatedWord, fastestWord };
}

/* ---------- badge persistence ---------- */

function getRevealStorageKey(year, month) {
  return `${storagePrefix}badge_revealed_${getMonthKey(year, month)}`;
}

function isBadgeRevealed(year, month) {
  return localStorage.getItem(getRevealStorageKey(year, month)) === "1";
}

function setBadgeRevealed(year, month) {
  localStorage.setItem(getRevealStorageKey(year, month), "1");
}

/* ---------- popup ---------- */

const FORCE_BADGE_KEY = "__JOSZO_BADGE_FORCE_OPEN__";

function setBadgeForceOpen(enabled) {
  if (enabled) localStorage.setItem(FORCE_BADGE_KEY, "1");
  else localStorage.removeItem(FORCE_BADGE_KEY);
}

function isBadgeForceOpen() {
  return localStorage.getItem(FORCE_BADGE_KEY) === "1";
}

async function openBadgePopup(month, year, { forceReveal }) {
  const data = collectMonthData(month, year);
  const tier = getBadgeTier(data.greenDays, data.playableDays);
  const stats = computeMonthlyWordStats(data.entries);

  // reset popup state
  badgeRevealWrap.classList.remove("badge-reveal-animate");
  badgeRevealIcon.className = `badge-reveal-icon ${tierClass(tier)}`;
  badgeRevealTitle.textContent = `${tierLabel(tier)} • ${monthNames[month]} ${year}`;

  clearStats();

  badgeDialog.showModal();

  requestAnimationFrame(() => {
    badgeRevealWrap.classList.add("badge-reveal-animate");
  });

  const alreadyRevealed = isBadgeRevealed(year, month);

  if (!alreadyRevealed && forceReveal) {
    setBadgeRevealed(year, month);

    // update archive badge immediately
    badgeIcon.className = `badge-icon ${tierClass(tier)}`;
    badgeText.textContent = `${tierLabel(tier)}`;

    await revealStatLabelThenScrambleWord(
      statFav,
      "kedvenc szavad: ",
      stats.favoriteWord || "—",
      1200
    );

    await revealStatLabelThenScrambleWord(
      statFast,
      "leggyorsabb szavad: ",
      stats.fastestWord || "—",
      650
    );
	
    await revealStatLabelThenScrambleWord(
      statHate,
      "legutálatosabb szavad: ",
      stats.hatedWord || "—",
      650
    );
	await revealCongratsText(statCongrats, pickRandomCongrats(), 500);


  } else {
    // already revealed -> show instantly (no scramble)
    const showNow = (el, label, word) => {
      el.innerHTML = "";
      el.classList.remove("hidden");
      el.classList.add("show");
      el.classList.add("scramble-done");

      const labelSpan = document.createElement("span");
      labelSpan.textContent = label;

      const wordSpan = document.createElement("span");
      wordSpan.textContent = word || "—";

      el.appendChild(labelSpan);
      el.appendChild(wordSpan);
    };

    showNow(statFav, "kedvenc szavad: ", stats.favoriteWord);
	showNow(statFast, "leggyorsabb szavad: ", stats.fastestWord);
    showNow(statHate, "legutálatosabb szavad: ", stats.hatedWord);
	
	statCongrats.textContent = pickRandomCongrats();
	statCongrats.classList.remove("hidden");
	statCongrats.classList.add("show");
  }
}

badgeClose?.addEventListener("click", () => {
  badgeDialog.close();
});

badgeDialog?.addEventListener("click", (e) => {
  const rect = badgeDialog.getBoundingClientRect();
  const inside =
    e.clientX >= rect.left &&
    e.clientX <= rect.right &&
    e.clientY >= rect.top &&
    e.clientY <= rect.bottom;

  if (!inside) badgeDialog.close();
});

/* ---------- UI update ---------- */

function updateMonthlyBadge(month, year) {
  if (!monthlyBadgeArea) return;

  const data = collectMonthData(month, year);

  if (data.playableDays === 0) {
    monthlyBadgeArea.classList.add("hidden");
    return;
  } else {
    monthlyBadgeArea.classList.remove("hidden");
  }

  const tier = getBadgeTier(data.greenDays, data.playableDays);
  const revealed = isBadgeRevealed(year, month);

  badgeIcon.className = "badge-icon badge-locked";
  badgeText.textContent = "Próbáld meg kitalálni az összes szót, hogy megszerezd a havi jelvényt!";

  if (data.completedAllDays || isBadgeForceOpen()) {
    badgeText.textContent = "Nézd meg a jelvényed!";

    if (revealed) {
      badgeIcon.className = `badge-icon ${tierClass(tier)}`;
      badgeText.textContent = `${tierLabel(tier)}`;
    }

    badgeIcon.style.cursor = "pointer";
    badgeIcon.onclick = () => openBadgePopup(month, year, { forceReveal: !revealed });

  } else {
    badgeIcon.style.cursor = "default";
    badgeIcon.onclick = null;
  }
}

/* ---------- RENDER ---------- */

function renderCalendar(month, year) {
  calendarGrid.innerHTML = '';
  monthNameEl.textContent = `${monthNames[month]} ${year}`;

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = (firstDay + 6) % 7;
  const startOffset = firstDay;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let i = 0; i < startOffset; i++) {
    calendarGrid.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const square = document.createElement('div');
    square.className = 'day-square';
    square.textContent = day;

    const d = new Date(year, month, day);
    d.setHours(0,0,0,0);
    const key = dateKeyLocal(d);

    const dayIndex = daysBetween(d, START_DATE);
    const todayIndex = daysBetween(new Date(), START_DATE);

    if (dayIndex < 0) {
      square.classList.add('day-unavailable');
    } else if (dayIndex > todayIndex) {
      square.classList.add('day-unavailable');
    } else {
      const state = safeParse(localStorage.getItem(storagePrefix + key));

      if (!state) {
        square.classList.add('day-available');
      } else if (state.done && state.guesses?.includes(state.target)) {
        square.classList.add('day-correct');
      } else if (state.done) {
        square.classList.add('day-present');
      } else {
        square.classList.add('day-available');
      }

      square.style.cursor = 'pointer';
      square.onclick = () => {
        window.location.href = `index.html?date=${key}`;
      };
    }

    calendarGrid.appendChild(square);
  }

  updateMonthlyBadge(month, year);
}

/* ---------- NAV ---------- */

prevMonthBtn.onclick = () => {
  displayedMonth--;
  if (displayedMonth < 0) {
    displayedMonth = 11;
    displayedYear--;
  }
  renderCalendar(displayedMonth, displayedYear);
};

nextMonthBtn.onclick = () => {
  displayedMonth++;
  if (displayedMonth > 11) {
    displayedMonth = 0;
    displayedYear++;
  }
  renderCalendar(displayedMonth, displayedYear);
};

renderCalendar(displayedMonth, displayedYear);

/* ---------- DEBUG API (console) ---------- */

window.badge = {
     // forceOpen() {
      // setBadgeForceOpen(true);
      // console.log("Badge forced open (debug enabled)");
      // renderCalendar(displayedMonth, displayedYear);
    // },
   reset() {
     setBadgeForceOpen(false);
     localStorage.removeItem(getRevealStorageKey(displayedYear, displayedMonth));
     console.log("Badge reset for current month");
     renderCalendar(displayedMonth, displayedYear);
   }
 };
