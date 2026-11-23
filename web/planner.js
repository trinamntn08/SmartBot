export const defaultBudget = 25;

export function localDay(now = new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone) {
  const parts = new Intl.DateTimeFormat('en', {
    calendar: 'iso8601', numberingSystem: 'latn', timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const { year, month, day } = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return { date: `${year}-${month}-${day}`, timeZone };
}

export function newRoutine() {
  return { settings: null, book: null, nextBookId: 1, plans: {} };
}

export function savePreferences(routine, { budget, title, page }) {
  routine.settings = { budget };
  if (!title) {
    routine.book = null;
    return;
  }
  if (routine.book?.title === title) {
    routine.book.page = page ?? routine.book.page;
    return;
  }
  routine.book = { id: routine.nextBookId++, title, page };
}

export function ensurePlan(routine, day) {
  if (!routine.settings || routine.plans[day.date]?.reading) return;
  const { budget } = routine.settings;
  routine.plans[day.date] = {
    ...day,
    ...routine.plans[day.date],
    budget,
    reading: { minutes: budget >= 10 ? 10 : 5, status: 'pending', book: null, outcome: null },
  };
}

export function updateReading(routine, date, action) {
  const reading = routine.plans[date]?.reading;
  if (!reading) return;
  const open = reading.status === 'pending' || reading.status === 'started';

  switch (action.type) {
    case 'estimate':
      if (open) reading.minutes = action.minutes;
      break;
    case 'start':
      if (reading.status === 'pending' && routine.book) {
        reading.book = { ...routine.book };
        reading.status = 'started';
      }
      break;
    case 'finish': {
      if (reading.status !== 'started') return;
      const currentBook = routine.book?.id === reading.book.id ? routine.book : null;
      const page = action.page ?? (currentBook ? currentBook.page : reading.book.page);
      reading.book.page = page;
      if (currentBook) currentBook.page = page;
      reading.outcome = { minutes: action.minutes, page };
      reading.status = 'completed';
      break;
    }
    case 'skip':
      if (open) reading.status = 'skipped';
      break;
    case 'undo':
      if (reading.status === 'completed' || reading.status === 'skipped') {
        reading.status = reading.book ? 'started' : 'pending';
        reading.outcome = null;
      }
      break;
  }
}

export function recentPlans(routine, date) {
  const earliest = new Date(`${date}T00:00:00Z`);
  earliest.setUTCDate(earliest.getUTCDate() - 6);
  const first = earliest.toISOString().slice(0, 10);
  return Object.keys(routine.plans).sort().reverse()
    .filter((key) => key >= first && key <= date)
    .map((key) => routine.plans[key]);
}
