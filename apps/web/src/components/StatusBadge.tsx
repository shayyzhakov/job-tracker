import { type ApplicationStatus, STATUS_LABELS } from '@job-tracker/shared';
import { Badge, type MantineColor } from '@mantine/core';

export const STATUS_COLORS: Record<ApplicationStatus, MantineColor> = {
  to_apply: 'gray',
  applied: 'blue',
  hr_screening: 'cyan',
  phone_interview: 'teal',
  technical_interview: 'violet',
  home_assignment: 'grape',
  onsite_interview: 'indigo',
  final_interview: 'orange',
  offer: 'lime',
  accepted: 'green',
  rejected: 'red',
  withdrawn: 'dark',
  ghosted: 'pink',
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <Badge color={STATUS_COLORS[status]} variant="light">
      {STATUS_LABELS[status]}
    </Badge>
  );
}
