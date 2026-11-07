import type { CompanyDto } from '@job-tracker/shared';
import { Badge } from '@mantine/core';

/** "Corporate" badge shown next to the name of corporate-sized companies. */
export function CorporateBadge({ company }: { company: CompanyDto }) {
  if (company.size !== 'corporate') return null;
  return (
    <Badge size="xs" variant="light" color="blue" ml={6} style={{ verticalAlign: 'middle' }}>
      Corporate
    </Badge>
  );
}
