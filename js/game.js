// js/game.js
import { START_DATE, STORAGE_PREFIX } from './config.js';
import { parseCSV, parseLocalDate, dateKeyLocal } from './utils.js';
import { getTrustedToday } from './time.js';

const urlParams = new URLSearchParams(window.location.search);
const forcedDate = urlParams.get('date'); // YYYY-MM-DD or null
const todayKey = forcedDate || dateKeyLocal(new Date());
const storageKey = STORAGE_PREFIX + todayKey;

/* ---------- LOADING TEXT ---------- */
const loadingText = document.getElementById('loadingText');
const loadingDots = document.getElementById('loadingDots');

let dotCount = 1;

const loadingInterval = setInterval(() => {
  dotCount = dotCount % 3 + 1;
  loadingDots.textContent = '.'.repeat(dotCount);
}, 500);


/* ---------- DAILY PICK ---------- */

async function daysSinceStart() {
  const today = await getTrustedToday();
  return Math.floor((today - START_DATE) / 86400000);
}

/* ---------- LOAD DATA ---------- */
Promise.all([
  fetch('data/daily_words.csv').then(r => r.text()),
  fetch('data/allowed_words.txt').then(r => r.text())
]).then(async ([dailyCSV, allowedTxt]) => {

  const dailyWords = parseCSV(dailyCSV);

  /* merge daily words into allowed words */
  const allowedSet = new Set(allowedTxt.split(/\s+/).filter(Boolean));
  dailyWords.forEach(d => allowedSet.add(d.word));
  const allowed = [...allowedSet];
  const submitWordBtn = document.getElementById('submitWordBtn');
  const archiveBtn = document.getElementById('archiveBtn');
  const forcedArchiveBtnText = "Vissza a jó öreg szavakhoz";
  const forcedDateLabel = document.getElementById('forcedDateLabel');

  let daysSinceSt = await daysSinceStart();
  let dayIndex = daysSinceSt;
  
  if (forcedDate) {
	archiveBtn.textContent = forcedArchiveBtnText;
    const forced = parseLocalDate(forcedDate);
    dayIndex = Math.floor((forced - START_DATE) / 86400000);
  }
  
  let forcedDateIsToday = dayIndex === daysSinceSt;
  
  if (forcedDate && dayIndex > daysSinceSt) {
    document.body.innerHTML =
      '<h2 style="color:white;text-align:center">Na de hova sietünk ennyire?</h2>';
    return;
  }
  
  if (dayIndex < 0) {
       document.body.innerHTML =
      '<h2 style="color:white;text-align:center">Mi vagy te, régész?</h2>';
    return;
  }
  
  if (dayIndex >= dailyWords.length) {
    document.body.innerHTML =
  	'<h2 style="color:white;text-align:center">Elfogytak a napi szavak 😢</h2>';
    return;
  }
  
  const daily = dailyWords[dayIndex];
  const target = daily.word;
  const authorScore = daily.score ?? '–';

  const len = target.length;
  const minGuessesLimit = 6;
  const maxGuessesLimit = 9;
  const maxGuesses = Math.max(minGuessesLimit, Math.min(maxGuessesLimit, len));

  const board = document.getElementById('board');
  const keyboard = document.getElementById('keyboard');
  const msg = document.getElementById('msg');
  const dialog = document.getElementById('rateDialog');
  const slider = document.getElementById('ratingSlider');
  const sliderValue = document.getElementById('ratingValue');
  const submitRating = document.getElementById('rateSubmit');

  board.style.gridTemplateRows = `repeat(${maxGuesses}, 1fr)`;

	let state = JSON.parse(localStorage.getItem(storageKey)) || {
	  guesses: [],
	  results: [],
	  current: '',
	  done: false,
	  rated: false
	};

	/* ---- STATE MIGRATION ---- */
	if (!Array.isArray(state.results)) state.results = [];
	if (!Array.isArray(state.guesses)) state.guesses = [];
	if (typeof state.current !== 'string') state.current = '';
	
	/* ---- ARCHIVE SUPPORT ---- */
	if (!state.target) state.target = target;


  const KEYBOARD = [
    ['q','w','e','r','t','z','u','i','o','p','ő','ú'],
    ['a','s','d','f','g','h','j','k','l','é','á','ű','í'],
    ['enter','y','x','c','v','b','n','m','ö','ü','ó','back']
  ];

  /* ---------- RENDER BOARD ---------- */
  function renderBoard() {
    board.innerHTML = '';
    for (let r = 0; r < maxGuesses; r++) {
      const row = document.createElement('div');
      row.className = 'row';
	  row.style.setProperty('--cells-per-row', len);
      row.style.setProperty('--num-guesses', maxGuesses);
      row.style.gridTemplateColumns = `repeat(${len},1fr)`;

      const guess = state.guesses[r] || '';
      const res = state.results[r] || [];

      for (let i = 0; i < len; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.textContent = guess[i] || '';
        if (res[i]) cell.classList.add(res[i]);
        row.appendChild(cell);
      }
      board.appendChild(row);
    }
  }

  /* ---------- WORD EVAL ---------- */
  function evaluateGuess(guess) {
    const res = Array(len).fill('absent');
    const counts = {};

    for (const c of target) counts[c] = (counts[c] || 0) + 1;

    for (let i = 0; i < len; i++) {
      if (guess[i] === target[i]) {
        res[i] = 'correct';
        counts[guess[i]]--;
      }
    }

    for (let i = 0; i < len; i++) {
      if (res[i] !== 'correct' && counts[guess[i]] > 0) {
        res[i] = 'present';
        counts[guess[i]]--;
      }
    }

    return res;
  }

  /* ---------- APPLY GUESS ---------- */
  function applyRow(rowIdx, guess) {
    const res = evaluateGuess(guess);
    state.results[rowIdx] = res;

    const row = board.children[rowIdx];
    [...row.children].forEach((cell, i) => {
      setTimeout(() => {
        cell.classList.add('flip', res[i]);
        updateKey(guess[i], res[i]);
      }, i * 300);
    });
  }

  /* ---------- KEYBOARD COLORS ---------- */
  function updateKey(letter, cls) {
    const key = keyboard.querySelector(`[data-key="${letter}"]`);
    if (!key) return;
    if (key.classList.contains('correct')) return;
    if (key.classList.contains('present') && cls === 'absent') return;

    key.classList.remove('absent', 'present', 'correct');
    key.classList.add(cls);
  }

  /* ---------- CONFETTI ---------- */
  function confetti() {
    for (let i = 0; i < 80; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = `hsl(${Math.random()*360},80%,60%)`;
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 3000);
    }
  }
  
    /* ---------- SLIDERS ---------- */

    // default colors: red → yellow → green
  const sliderColors = [
    { r: 199, g: 76, b: 60 },    // red
    { r: 230, g: 212, b: 57 },  // yellow
    { r: 93, g: 219, b: 68 }     // green
  ];
	
  function interpolateColor(value, min, max, colorStops) {
    value = Number(value);
    min = Number(min);
    max = Number(max);
  
    const percentage = (value - min) / (max - min);
    const numStops = colorStops.length - 1;
  
    // clamp scaled to be within 0..numStops
    let scaled = Math.min(percentage * numStops, numStops - 0.0001);
  
    let idx = Math.floor(scaled);
    let t = scaled - idx;
  
    const c1 = colorStops[idx];
    const c2 = colorStops[idx + 1];
  
    const r = Math.round(c1.r + (c2.r - c1.r) * t);
    const g = Math.round(c1.g + (c2.g - c1.g) * t);
    const b = Math.round(c1.b + (c2.b - c1.b) * t);
  
    return `rgb(${r},${g},${b})`;
  }
	
	
  function updateSliderColor() {
    const value = slider.value;
    const color = interpolateColor(value, slider.min, slider.max, sliderColors);
    slider.style.background = color;
  }
  
  slider.oninput = () => {
    sliderValue.textContent = `${slider.value}/10`;
	updateSliderColor();
  };

  /* ---------- END GAME ---------- */
  
  function showScore(){
  	msg.innerHTML = `Szerinted: ${state.playerScore}/10 | A szerző szerint: ${authorScore}/10`;
  }
  
  function showSolutionToast(word) {
    // prevent duplicates
    if (document.querySelector('.solution-toast')) return;
    
    const toast = document.createElement('div');
    toast.className = 'solution-toast';
    toast.textContent = word;
    
    document.body.appendChild(toast);
  }
  
  function showEndButtons(){
    submitWordBtn.classList.remove('hidden');
	archiveBtn.classList.remove('hidden');
  }
  
  function showArchiveButton(){
	archiveBtn.classList.remove('hidden');
  }

  function endGame(win) {
    state.done = true;
	state.target = target;
    localStorage.setItem(storageKey, JSON.stringify(state));

	hideKeyboard(); 
    showEndButtons();
   
    if (win){
		confetti();
	}
	else {
		showSolutionToast(target);
	}

    slider.value = 5;
	updateSliderColor();
    sliderValue.textContent = '5/10';
	document.getElementById('popupDescription').textContent = daily.description;
    dialog.showModal();
  }

  submitRating.onclick = () => {
    state.rated = true;
    state.playerScore = slider.value;
    localStorage.setItem(storageKey, JSON.stringify(state));
    dialog.close();
	showScore();
  };

  /* ---------- SUBMIT GUESS ---------- */
  function submitGuess() {
    if (state.done) return;
    if (state.current.length !== len) return;
    if (!allowed.includes(state.current)) {
      alert('Ez egy rossz szó');
      return;
    }

    const row = state.guesses.length;
    state.guesses.push(state.current);
    applyRow(row, state.current);

    if (state.current === target)
      setTimeout(() => endGame(true), len * 300 + 300);
    else if (state.guesses.length >= maxGuesses)
      setTimeout(() => endGame(false), len * 300 + 300);

    state.current = '';
    localStorage.setItem(storageKey, JSON.stringify(state));
  }

  /* ---------- INPUT ---------- */
  function pressKey(k) {
    if (state.done) return;

    if (k === 'enter') return submitGuess();
    if (k === 'back') state.current = state.current.slice(0, -1);
    else if (state.current.length < len) state.current += k;

    const row = board.children[state.guesses.length];
    [...row.children].forEach((c, i) => c.textContent = state.current[i] || '');
  }
  
  document.addEventListener('keydown', (e) => {
    if (state.done) return;
  
    let key = e.key.toLowerCase();
  
    if (key === 'enter') {
      pressKey('enter');
      return;
    }
  
    if (key === 'backspace') {
      pressKey('back');
      return;
    }
  
    const allowedLetters = 'aábcdeéfghiíjklmnoóöőpqrstuúüűvwxyz';
  
    if (allowedLetters.includes(key)) {
      pressKey(key);
    }
  });


  function renderKeyboard() {
    keyboard.innerHTML = '';
    KEYBOARD.forEach(r => {
      const row = document.createElement('div');
      row.className = 'kb-row';
	  row.style.setProperty('--keys-per-row', r.length);
	  row.style.setProperty('--num-guesses', maxGuesses);
      r.forEach(k => {
        const b = document.createElement('div');
        b.className = 'key' + ((k === 'enter' || k === 'back') ? ' wide' : '');
        b.textContent = k === 'back' ? '⌫' : k.toUpperCase();
        b.dataset.key = k;
        b.onclick = () => pressKey(k);
        row.appendChild(b);
      });
      keyboard.appendChild(row);
    });
  }
  
  function restoreKeyboardColors() {
	state.results.forEach((row, rIdx) => {
		const guess = state.guesses[rIdx];
		if (!guess) return;
	
		row.forEach((cls, i) => {
		updateKey(guess[i], cls);
		});
	});
	}

  
  function hideKeyboard() {
	keyboard.innerHTML = '';
	keyboard.style.display = 'none';
	keyboard.style.margin = '1vh 0';
	}
	
	renderBoard();
	
	if (!state.done) {
	  renderKeyboard();
	  restoreKeyboardColors();
	}
	else{
	  hideKeyboard();
	}

	if(forcedDate && !forcedDateIsToday){
		showArchiveButton();
		forcedDateLabel.textContent = forcedDate;
        forcedDateLabel.classList.remove('hidden');
	}

	if (state.done) {
		showEndButtons();

		if(state.playerScore != null){
			showScore();
		}
		if (!state.guesses.includes(target)){
			showSolutionToast(target);
		}
	}

			
	clearInterval(loadingInterval);
	loadingText.remove();

});

window.clearJoszo = function(cmd) {
  if (cmd === 'all') {
    Object.keys(localStorage)
      .filter(k => k.startsWith('joszo-'))
      .forEach(k => localStorage.removeItem(k));
    console.log('All data cleared');
    return;
  }

  if (cmd.startsWith('20')) {
    const key = cmd;
    localStorage.removeItem('joszo-' + key);
    console.log('Cleared:', key);
  }
};