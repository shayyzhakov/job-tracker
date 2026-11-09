import {
  APPLICATION_STATUSES,
  type ApplicationStatus,
  INITIAL_STATUSES,
  STATUS_LABELS,
} from '@job-tracker/shared';
import { Select, type SelectProps } from '@mantine/core';

export const STATUS_OPTIONS = APPLICATION_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

interface Props extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  value: ApplicationStatus | null;
  onChange: (status: ApplicationStatus) => void;
  /** The application has interviews: going back to to apply / applied is not offered. */
  hasInterviews?: boolean;
}

export function StatusSelect({ value, onChange, hasInterviews, ...rest }: Props) {
  const data = hasInterviews
    ? STATUS_OPTIONS.map((o) => ({
        ...o,
        disabled: (INITIAL_STATUSES as readonly string[]).includes(o.value),
      }))
    : STATUS_OPTIONS;
  return (
    <Select
      data={data}
      value={value}
      onChange={(v) => v && onChange(v as ApplicationStatus)}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
      {...rest}
    />
  );
}
