import { Button, Checkbox, CloseButton, Group, Popover, Stack } from '@mantine/core';
import { IconChevronDown } from '@tabler/icons-react';

interface Props<T extends string> {
  /** Name of the field being filtered, e.g. "Size". Also the accessible name. */
  label: string;
  /** Button text when nothing is selected, e.g. "All sizes". */
  allLabel: string;
  options: { value: T; label: string }[];
  value: T[];
  onChange: (value: T[]) => void;
}

/**
 * Compact multi-select filter: a fixed-size button that opens a checklist.
 * Unlike a pill-based MultiSelect it never grows taller as options are picked.
 * Nothing selected means "no filtering".
 */
export function MultiFilter<T extends string>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: Props<T>) {
  const summary =
    value.length === 0
      ? allLabel
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${label}: ${value.length} selected`;

  return (
    <Popover position="bottom-start" shadow="md" withinPortal>
      <Popover.Target>
        <Button
          variant={value.length ? 'light' : 'default'}
          aria-label={`${label} filter`}
          rightSection={
            value.length ? (
              <CloseButton
                size="xs"
                component="span"
                aria-label={`Clear ${label.toLowerCase()} filter`}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange([]);
                }}
              />
            ) : (
              <IconChevronDown size={14} />
            )
          }
          w={190}
          justify="space-between"
          fw={400}
        >
          {summary}
        </Button>
      </Popover.Target>
      <Popover.Dropdown>
        <Checkbox.Group value={value} onChange={(v) => onChange(v as T[])}>
          <Stack gap="xs">
            {options.map((o) => (
              <Checkbox key={o.value} value={o.value} label={o.label} />
            ))}
          </Stack>
        </Checkbox.Group>
      </Popover.Dropdown>
    </Popover>
  );
}
