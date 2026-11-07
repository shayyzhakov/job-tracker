import { ActionIcon, Group, Text, Tooltip, UnstyledButton } from '@mantine/core';
import { IconFlame, IconSparkles } from '@tabler/icons-react';
import { Link } from 'react-router';
import { useGamificationEnabled } from './enabled';
import { Runtime } from './Runtime';
import { useGame } from './useGame';

/** header.right slot: level + streak chip, or a way back in when the layer is switched off. */
export function HeaderChip() {
  const [enabled, setEnabled] = useGamificationEnabled();
  const state = useGame();

  if (!enabled) {
    return (
      <Tooltip label="Turn on gamification">
        <ActionIcon aria-label="Turn on gamification" onClick={() => setEnabled(true)}>
          <IconSparkles size={18} />
        </ActionIcon>
      </Tooltip>
    );
  }
  return (
    <>
      <Runtime />
      {state && (
        <Tooltip
          label={`${state.game.level.xpIntoLevel} / ${state.game.level.xpForNext} XP`}
          withArrow
        >
          <UnstyledButton
            component={Link}
            to="/achievements"
            aria-label="Open achievements"
            data-testid="gm-chip"
          >
            <Group gap={10} className="gm-chip" wrap="nowrap">
              <Text size="xs" fw={700} className="tabular-nums">
                Lv {state.game.level.level}
              </Text>
              <div className="gm-chip-bar" aria-hidden>
                <div
                  style={{
                    width: `${Math.round(state.game.level.pct * 100)}%`,
                  }}
                />
              </div>
              <Group
                gap={2}
                wrap="nowrap"
                className={state.game.streak.activeToday ? 'gm-flame gm-flame--on' : 'gm-flame'}
              >
                <IconFlame size={16} aria-hidden />
                <Text size="xs" fw={700} className="tabular-nums">
                  {state.game.streak.current}
                </Text>
              </Group>
            </Group>
          </UnstyledButton>
        </Tooltip>
      )}
    </>
  );
}
