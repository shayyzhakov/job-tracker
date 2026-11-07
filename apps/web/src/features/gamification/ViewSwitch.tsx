import { SegmentedControl } from '@mantine/core';
import { useNavigate } from 'react-router';
import { useGamificationEnabled } from './enabled';

/** Table | Pipeline switch shown on both views of the applications page. */
export function ViewSwitch({ current }: { current: 'table' | 'pipeline' }) {
  const [enabled] = useGamificationEnabled();
  const navigate = useNavigate();
  if (!enabled) return null;
  return (
    <SegmentedControl
      size="xs"
      value={current}
      aria-label="Applications view"
      onChange={(v) => navigate(v === 'pipeline' ? '/applications/pipeline' : '/applications')}
      data={[
        { value: 'table', label: 'Table' },
        { value: 'pipeline', label: 'Pipeline' },
      ]}
    />
  );
}
