import { useLocalStorage } from '@mantine/hooks';

/** Build-time kill switch: VITE_GAMIFICATION=false removes the layer entirely. */
export const BUILD_ENABLED = import.meta.env.VITE_GAMIFICATION !== 'false';

/** Runtime switch (per browser). Off = nothing renders, no requests, no effects. */
export function useGamificationEnabled(): [boolean, (on: boolean) => void] {
  const [stored, setStored] = useLocalStorage<boolean>({
    key: 'gamification.enabled',
    defaultValue: true,
    getInitialValueInEffect: false,
  });
  return [BUILD_ENABLED && stored, setStored];
}
