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
const date = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const fullDateTime = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatIls = (v: number | null) => (v === null ? '—' : ils.format(v));
export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null) => (iso ? date.format(new Date(iso)) : '—');
export const formatPercent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
export const formatFullDateTime = (iso: string | null) =>
  iso ? fullDateTime.format(new Date(iso)) : '—';
/** Date plus time, but only when the source carried a real time (not a bare date at midnight). */
export const formatDateMaybeTime = (iso: string | null) => {
  if (!iso) return '—';
  const d = new Date(iso);
  const hasTime = d.getUTCHours() !== 0 || d.getUTCMinutes() !== 0 || d.getUTCSeconds() !== 0;
  return hasTime ? fullDateTime.format(d) : date.format(d);
};
