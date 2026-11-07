import {
  IconConfetti,
  IconFlag,
  IconFlame,
  IconMessageCircle,
  IconMicrophone,
  IconPuzzle,
  IconSend,
  IconTrophy,
  IconUsers,
} from '@tabler/icons-react';
import type { ComponentType } from 'react';

export const ACHIEVEMENT_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  flag: IconFlag,
  send: IconSend,
  message: IconMessageCircle,
  microphone: IconMicrophone,
  puzzle: IconPuzzle,
  users: IconUsers,
  flame: IconFlame,
  trophy: IconTrophy,
  confetti: IconConfetti,
};

export const TIER_COLORS = { bronze: 'orange', silver: 'gray', gold: 'yellow' } as const;
