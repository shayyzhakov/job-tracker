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

export const formatIls = (v: number | null) => (v === null ? '—' : ils.format(v));
export const formatDateTime = (iso: string | null) => (iso ? dateTime.format(new Date(iso)) : '—');
export const formatDate = (iso: string | null) => (iso ? date.format(new Date(iso)) : '—');
export const formatPercent = (v: number | null) => (v === null ? '—' : `${Math.round(v * 100)}%`);
