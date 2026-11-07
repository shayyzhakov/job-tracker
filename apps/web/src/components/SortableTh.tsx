import { Center, Group, Table, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronUp, IconSelector } from '@tabler/icons-react';
import { type ReactNode, useMemo, useRef, useState } from 'react';

export type SortDirection = 'asc' | 'desc';
export interface SortState<K extends string> {
  key: K;
  direction: SortDirection;
}

type SortValue = string | number | null | undefined;

/**
 * Client-side column sorting. `getters` maps each sortable column key to a value
 * extractor. Empty values (null/undefined) always sort last, in either direction.
 */
export function useSortedRows<T, K extends string>(
  rows: readonly T[],
  getters: Record<K, (row: T) => SortValue>,
  initial: SortState<K> | null = null,
) {
  const [sort, setSort] = useState<SortState<K> | null>(initial);
  const gettersRef = useRef(getters);
  gettersRef.current = getters;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const get = gettersRef.current[sort.key];
    const dir = sort.direction === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = get(a);
      const vb = get(b);
      const ea = va === null || va === undefined || va === '';
      const eb = vb === null || vb === undefined || vb === '';
      if (ea || eb) return ea === eb ? 0 : ea ? 1 : -1;
      if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
      return String(va).localeCompare(String(vb), undefined, { sensitivity: 'base' }) * dir;
    });
  }, [rows, sort]);

  /** Cycles asc → desc → unsorted for a column. */
  const toggle = (key: K) =>
    setSort((s) =>
      s?.key !== key
        ? { key, direction: 'asc' }
        : s.direction === 'asc'
          ? { key, direction: 'desc' }
          : null,
    );

  return { sorted, sort, toggle };
}

export function SortableTh<K extends string>({
  columnKey,
  sort,
  onSort,
  children,
  w,
}: {
  columnKey: K;
  sort: SortState<K> | null;
  onSort: (key: K) => void;
  children: ReactNode;
  w?: number;
}) {
  const active = sort?.key === columnKey;
  const Icon = !active ? IconSelector : sort.direction === 'asc' ? IconChevronUp : IconChevronDown;
  return (
    <Table.Th
      w={w}
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <UnstyledButton onClick={() => onSort(columnKey)} fw={600} fz="sm">
        <Group gap={4} wrap="nowrap">
          {children}
          <Center c={active ? undefined : 'dimmed'}>
            <Icon size={14} />
          </Center>
        </Group>
      </UnstyledButton>
    </Table.Th>
  );
}
