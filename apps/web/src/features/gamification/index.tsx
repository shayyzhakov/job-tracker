/**
 * Gamification: an optional side layer (XP, levels, streaks, achievements, quests, pipeline board).
 *
 * Plugs into core only through generic extension points (lib/extensions, lib/app-events) and reads
 * progress from GET /api/v1/progress. Core never imports this folder except main.tsx.
 * Unplug: delete the `registerGamification()` call in main.tsx (and optionally this folder).
 */

import type { ApplicationStatus } from '@job-tracker/shared';
import { registerRoute, registerSlot } from '../../lib/extensions';
import { AchievementsPage } from './AchievementsPage';
import { BUILD_ENABLED } from './enabled';
import { HeaderChip } from './HeaderChip';
import { PipelinePage } from './PipelinePage';
import { ProgressHero } from './ProgressHero';
import { StageProgress } from './StageProgress';
import { ViewSwitch } from './ViewSwitch';
import './gamification.css';

/** Plugs the layer into core. Returns a function that unplugs it again (used by tests). */
export function registerGamification(): () => void {
  if (!BUILD_ENABLED) return () => {};
  const undo = [
    registerSlot('header.right', 'gamification', HeaderChip),
    registerSlot('overview.top', 'gamification', ProgressHero),
    registerSlot('application.detail.top', 'gamification', (p) => (
      <StageProgress status={p.status as ApplicationStatus | undefined} />
    )),
    registerSlot('applications.views', 'gamification', () => <ViewSwitch current="table" />),
    registerRoute({ path: 'achievements', Component: AchievementsPage }),
    registerRoute({ path: 'applications/pipeline', Component: PipelinePage }),
  ];
  return () => {
    for (const off of undo) off();
  };
}
