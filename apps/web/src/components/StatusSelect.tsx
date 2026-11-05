import { APPLICATION_STATUSES, type ApplicationStatus, STATUS_LABELS } from '@job-tracker/shared';
import { Select, type SelectProps } from '@mantine/core';

export const STATUS_OPTIONS = APPLICATION_STATUSES.map((s) => ({
  value: s,
  label: STATUS_LABELS[s],
}));

interface Props extends Omit<SelectProps, 'data' | 'value' | 'onChange'> {
  value: ApplicationStatus | null;
  onChange: (status: ApplicationStatus) => void;
}

export function StatusSelect({ value, onChange, ...rest }: Props) {
  return (
    <Select
      data={STATUS_OPTIONS}
      value={value}
      onChange={(v) => v && onChange(v as ApplicationStatus)}
      allowDeselect={false}
      comboboxProps={{ withinPortal: true }}
      {...rest}
    />
  );
}
