import type { ProgressDto } from '@job-tracker/shared';
import { notifications } from '@mantine/notifications';
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { AchievementsPage } from './AchievementsPage';
import { celebrate } from './celebrations';
import { ProgressHero } from './ProgressHero';
import { StageProgress } from './StageProgress';

const progress = (over: Partial<ProgressDto> = {}): ProgressDto => ({
  timezone: 'Asia/Jerusalem',
  today: '2026-11-06',
  days: [
    { date: '2026-11-06', added: 1, applied: 1, statusChanges: 0, interviews: 0, contacts: 0 },
  ],
  applicationsCount: 12,
  appliedCount: 12,
  stageReachedCounts: { offer: 1 },
  interviewsCount: 0,
  interviewTypesUsed: [],
  contactsCount: 0,
  ...over,
});

const serveProgress = (p: ProgressDto) =>
  server.use(http.get('/api/v1/progress', () => HttpResponse.json(p)));

beforeEach(() => localStorage.clear());

describe('ProgressHero', () => {
  it('shows level, XP and streak derived from progress facts', async () => {
    serveProgress(progress());
    renderRoute(<ProgressHero />);
    // 12*5 + 12*15 + 100 = 340 XP -> level 3 (240..480)
    expect(await screen.findByTestId('gm-level')).toHaveTextContent('3');
    expect(screen.getByTestId('gm-streak')).toHaveTextContent('1-day streak');
  });

  it('renders nothing and requests nothing when switched off', async () => {
    localStorage.setItem('gamification.enabled', 'false');
    const hit = vi.fn();
    server.use(
      http.get('/api/v1/progress', () => {
        hit();
        return HttpResponse.json(progress());
      }),
    );
    renderRoute(<ProgressHero />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('gm-hero')).not.toBeInTheDocument();
    expect(hit).not.toHaveBeenCalled();
  });

  it('stays hidden when the API has the layer off (404)', async () => {
    server.use(
      http.get('/api/v1/progress', () => HttpResponse.json({ message: 'nope' }, { status: 404 })),
    );
    renderRoute(<ProgressHero />);
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByTestId('gm-hero')).not.toBeInTheDocument();
  });
});

describe('AchievementsPage', () => {
  it('shows unlocked and locked badges', async () => {
    serveProgress(progress());
    renderRoute(<AchievementsPage />);
    expect(await screen.findByTestId('badge-first-step')).toHaveAttribute('data-unlocked', 'true');
    expect(screen.getByTestId('badge-applicant-25')).toHaveAttribute('data-unlocked', 'false');
  });

  it('offers a way back in when switched off', async () => {
    localStorage.setItem('gamification.enabled', 'false');
    renderRoute(<AchievementsPage />);
    expect(await screen.findByRole('button', { name: 'Turn it on' })).toBeInTheDocument();
  });
});

describe('StageProgress', () => {
  it('shows the current stage on the happy path', () => {
    renderRoute(<StageProgress status="phone_interview" />);
    expect(screen.getByTestId('gm-stages')).toHaveTextContent('Phone interview');
  });

  it('marks closed statuses as off the path', () => {
    renderRoute(<StageProgress status="rejected" />);
    expect(screen.getByTestId('gm-stages')).toHaveTextContent('Closed: Rejected');
  });
});

describe('celebrate', () => {
  const show = vi.spyOn(notifications, 'show').mockImplementation(() => '');
  beforeEach(() => show.mockClear());

  it('seeds silently on first run (no retroactive rewards)', () => {
    celebrate(progress({ stageReachedCounts: {} }), progress(), {
      type: 'status.changed',
      applicationId: 'a',
      status: 'offer',
    });
    expect(show).not.toHaveBeenCalled();
    expect(localStorage.getItem('gamification.seen')).toContain('offer');
  });

  it('rewards XP and new achievements after a core event', () => {
    vi.useFakeTimers();
    const before = progress({ stageReachedCounts: {} });
    const after = progress();
    celebrate(before, before, { type: 'application.created', applicationId: 'a' }); // seed
    celebrate(before, after, { type: 'status.changed', applicationId: 'a', status: 'offer' });
    vi.advanceTimersByTime(2000);
    const titles = show.mock.calls.map((c) => c[0].title);
    expect(titles).toContain('+100 XP');
    expect(titles).toContain('Achievement unlocked: Offer in hand');

    show.mockClear();
    celebrate(after, after, { type: 'application.created', applicationId: 'b' });
    vi.advanceTimersByTime(2000);
    expect(show).not.toHaveBeenCalled(); // nothing new earned, nothing repeated
    vi.useRealTimers();
  });
});
