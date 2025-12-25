// js/time.js

import { dateKeyLocal, parseLocalDate } from './utils.js';
import { TRUSTED_DATE_KEY } from './config.js';

function fetchWithTimeout(url, options = {}, timeoutMs = 1500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .finally(() => clearTimeout(id)); 
}

export async function getTrustedToday() {
  const localToday = new Date();
  localToday.setHours(0,0,0,0);
  const localKey = dateKeyLocal(localToday);

  const cached = localStorage.getItem(TRUSTED_DATE_KEY);
  if (cached === localKey) {
    return parseLocalDate(cached);
  }

  const sources = [
    async () => {
      const r = await fetchWithTimeout(
        'https://timeapi.io/api/Time/current/zone?timeZone=Europe/Budapest',
        { cache: 'no-store' }
      );
      const j = await r.json();
      return new Date(j.dateTime);
    },
    async () => {
      const r = await fetchWithTimeout(
        'https://time.cloudflare.com/',
        { cache: 'no-store' }
      );
      const j = await r.json();
      return new Date(j.utc_datetime);
    }
  ];

  let tryCount = 1;
  for (const s of sources) {
    try {
      const d = await s();
      d.setHours(0,0,0,0);
      localStorage.setItem(TRUSTED_DATE_KEY, dateKeyLocal(d));
      return d;
    } catch (e) {
	  console.warn('tsf' + tryCount);
	  tryCount++;
    }
  }

  return localToday;
}
