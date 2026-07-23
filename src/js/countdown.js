/** Countdown + .ics helpers */
export function weddingDateObject(settings) {
  const d = settings.weddingDate;
  return new Date(d.year, d.month - 1, d.day, d.hour || 0, d.minute || 0);
}

export function daysUntil(target, now = new Date()) {
  const ms = target - now;
  return Math.ceil(ms / 86400000);
}
