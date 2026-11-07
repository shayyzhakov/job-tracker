import type { ProgressDto } from '@job-tracker/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { onAppEvent } from '../../lib/app-events';
import { celebrate, seedSeen } from './celebrations';
import { useGamificationEnabled } from './enabled';
import { PROGRESS_KEY, useProgress } from './useGame';

/** Invisible: listens to core events while enabled, refreshes progress and fires rewards. */
export function Runtime() {
  const [enabled] = useGamificationEnabled();
  const qc = useQueryClient();
  const { data } = useProgress();

  useEffect(() => {
    if (data) seedSeen(data);
  }, [data]);

  useEffect(() => {
    if (!enabled) return;
    return onAppEvent(async (event) => {
      const prev = qc.getQueryData<ProgressDto>(PROGRESS_KEY);
      await qc.invalidateQueries({ queryKey: PROGRESS_KEY });
      celebrate(prev, qc.getQueryData<ProgressDto>(PROGRESS_KEY), event);
    });
  }, [enabled, qc]);

  return null;
}
