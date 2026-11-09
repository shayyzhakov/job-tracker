const ils = new Intl.NumberFormat('en-IL', {
  style: 'currency',
  currency: 'ILS',
  maximumFractionDigits: 0,
});
const dateTime = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});
const date = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const fullDateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const time = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
});
const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "Today" / "Tomorrow" / "Yesterday" (local calendar day), otherwise null. */
export const relativeDayLabel = (d: Date, now: Date = new Date()): string | null => {
  const diff = Math.round((dayStart(d) - dayStart(now)) / 86_400_000);
  return diff === 0 ? 'Today' : diff === 1 ? 'Tomorrow' : diff === -1 ? 'Yesterday' : null;
};

export const formatIls = (v: number | null) => (v === null ? '—' : ils.format(v));
export const formatDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const rel = relativeDayLabel(d);
  return rel ? `${rel}, ${time.format(d)}` : dateTime.format(d);
};
export const formatDate = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return relativeDayLabel(d) ?? date.format(d);
};
export const formatPercent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
export const formatFullDateTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const rel = relativeDayLabel(d);
  return rel ? `${rel}, ${time.format(d)}` : fullDateTime.format(d);
};
/** Date plus time, but only when the source carried a real time (not a bare date at midnight). */
export const formatDateMaybeTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  return hasTime ? formatFullDateTime(iso) : formatDate(iso);
};
