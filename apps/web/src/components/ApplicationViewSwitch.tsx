import { SegmentedControl } from '@mantine/core';
import { useNavigate } from 'react-router';
import { useApplicationViews } from '../lib/extensions';

const CORE_VIEWS = [
  { id: 'table', label: 'Table', path: '/applications' },
  { id: 'timeline', label: 'Timeline', path: '/applications/timeline' },
];

/** Switches between the views of the applications page: Table, Timeline and any registered by optional layers. */
export function ApplicationViewSwitch({ current }: { current: string }) {
  const navigate = useNavigate();
  const views = [...CORE_VIEWS, ...useApplicationViews()];
  return (
    <SegmentedControl
      size="xs"
      value={current}
      aria-label="Applications view"
      onChange={(id) => {
        const view = views.find((v) => v.id === id);
        if (view) navigate(view.path);
      }}
      data={views.map((v) => ({ value: v.id, label: v.label }))}
    />
  );
}
