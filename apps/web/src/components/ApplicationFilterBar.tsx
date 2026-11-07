import {
  type ApplicationDto,
  COMPANY_SIZE_LABELS,
  COMPANY_SIZES,
  type CompanySize,
} from '@job-tracker/shared';
import { Button, Select } from '@mantine/core';
import { useSyncExternalStore } from 'react';

export interface LocalFilters {
  role: 'all' | 'management' | 'ic';
  company: 'all' | CompanySize;
}

const DEFAULTS: LocalFilters = { role: 'all', company: 'all' };

// Shared by the table and pipeline views so the selection survives switching between them.
let state: LocalFilters = DEFAULTS;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useLocalFilters() {
  const filters = useSyncExternalStore(subscribe, () => state);
  const set = (patch: Partial<LocalFilters>) => {
    state = { ...state, ...patch };
    for (const l of listeners) l();
  };
  return [filters, set] as const;
}

export const isFiltering = (f: LocalFilters) => f.role !== 'all' || f.company !== 'all';

export function applyLocalFilters(apps: ApplicationDto[], f: LocalFilters): ApplicationDto[] {
  return apps.filter(
    (a) =>
      (f.role === 'all' || a.isManagement === (f.role === 'management')) &&
      (f.company === 'all' || a.company.size === f.company),
  );
}

export function ApplicationFilterBar() {
  const [filters, set] = useLocalFilters();
  return (
    <>
      <Select
        aria-label="Role type"
        w={220}
        allowDeselect={false}
        value={filters.role}
        onChange={(v) => v && set({ role: v as LocalFilters['role'] })}
        data={[
          { value: 'all', label: 'All roles' },
          { value: 'management', label: 'Management' },
          { value: 'ic', label: 'Individual contributor' },
        ]}
      />
      <Select
        aria-label="Company size"
        w={190}
        allowDeselect={false}
        value={filters.company}
        onChange={(v) => v && set({ company: v as LocalFilters['company'] })}
        data={[
          { value: 'all', label: 'All company sizes' },
          ...COMPANY_SIZES.map((s) => ({ value: s, label: COMPANY_SIZE_LABELS[s] })),
        ]}
      />
      {isFiltering(filters) && (
        <Button variant="subtle" size="xs" onClick={() => set(DEFAULTS)}>
          Clear filters
        </Button>
      )}
    </>
  );
}
