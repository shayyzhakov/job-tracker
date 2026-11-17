import type { CompanyPriority } from '@job-tracker/shared';

export const BUCKET_HINTS: Record<CompanyPriority, string> = {
  top: 'Searched first, biggest score boost.',
  high: 'Searched early, score boost.',
  moderate: 'The default. New companies land here.',
  low: 'Searched last, score penalty.',
  blacklist: 'Never suggested.',
};

export const BUCKET_COLORS: Record<CompanyPriority, string> = {
  top: 'teal',
  high: 'green',
  moderate: 'gray',
  low: 'orange',
  blacklist: 'red',
};
