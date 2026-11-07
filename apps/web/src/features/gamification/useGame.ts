import { computeGameState, dayKey, type GameState, type ProgressDto } from '@job-tracker/shared';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { api } from '../../api/client';
import { useGamificationEnabled } from './enabled';

export const PROGRESS_KEY = ['gamification', 'progress'] as const;

/** Facts from the API; disabled (no request) when the layer is switched off. */
export function useProgress() {
  const [enabled] = useGamificationEnabled();
  return useQuery({
    queryKey: PROGRESS_KEY,
    queryFn: () => api<ProgressDto>('/progress'),
    enabled,
    retry: false, // a 404 means the API has the layer off; just stay hidden
    staleTime: 30_000,
  });
}

export const gameStateOf = (p: ProgressDto, now = new Date()): GameState =>
  computeGameState(p, dayKey(now, p.timezone));

export function useGame(): { progress: ProgressDto; game: GameState } | null {
  const { data } = useProgress();
  return useMemo(() => (data ? { progress: data, game: gameStateOf(data) } : null), [data]);
}
