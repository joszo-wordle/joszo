// js/archive.js
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

/* ---------- RENDER ---------- */

function renderCalendar(month, year) {
  calendarGrid.innerHTML = '';
  monthNameEl.textContent = `${monthNames[month]} ${year}`;

  let firstDay = new Date(year, month, 1).getDay();
  firstDay = (firstDay + 6) % 7; // convert Sunday=6, Monday=0
  const startOffset = firstDay; // Monday = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // empty leading cells
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

    // before game start
    if (dayIndex < 0) {
      square.classList.add('day-unavailable');
    }
    // future
    else if (dayIndex > todayIndex) {
      square.classList.add('day-unavailable');
    }
    // playable / archive
    else {
      const state = JSON.parse(localStorage.getItem(storagePrefix + key));

      if (!state) {
        square.classList.add('day-available'); // black
      } else if (state.done && state.guesses?.includes(state.target)) {
        square.classList.add('day-correct'); // green
      } else if (state.done) {
        square.classList.add('day-present'); // yellow
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
