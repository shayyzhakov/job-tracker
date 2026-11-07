/** The layer can be plugged and unplugged without touching core behaviour. */
import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderRoute } from '../../../test/render';
import { server } from '../../../test/server';
import { ApplicationsPage } from '../applications/ApplicationsPage';
import { OverviewPage } from '../overview/OverviewPage';
import { registerGamification } from './index';

const progress = {
  timezone: 'Asia/Jerusalem',
  today: '2026-11-06',
  days: [],
  applicationsCount: 1,
  appliedCount: 1,
  stageReachedCounts: {},
  interviewsCount: 0,
  interviewTypesUsed: [],
  contactsCount: 0,
};

let unplug: (() => void) | undefined;
beforeEach(() => localStorage.clear());
afterEach(() => {
  unplug?.();
  unplug = undefined;
});

describe('unplugged (nothing registered)', () => {
  it('core pages render with no gamification UI and no /progress request', async () => {
    const hit = vi.fn();
    server.use(http.get('/api/v1/progress', () => (hit(), HttpResponse.json(progress))));
    renderRoute(<OverviewPage />);
    expect(await screen.findByTestId('kpi-active')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-hero')).not.toBeInTheDocument();

    renderRoute(<ApplicationsPage />);
    expect(await screen.findByText('Applications')).toBeInTheDocument();
    expect(screen.queryByLabelText('Applications view')).not.toBeInTheDocument();
    expect(hit).not.toHaveBeenCalled();
  });
});

describe('plugged', () => {
  it('adds the hero and the view switch through slots, leaving core content intact', async () => {
    server.use(http.get('/api/v1/progress', () => HttpResponse.json(progress)));
    unplug = registerGamification();

    renderRoute(<OverviewPage />);
    expect(await screen.findByTestId('gm-hero')).toBeInTheDocument();
    expect(screen.getByTestId('kpi-active')).toBeInTheDocument();

    renderRoute(<ApplicationsPage />);
    expect(await screen.findByLabelText('Applications view')).toBeInTheDocument();
  });

  it('the runtime switch hides everything and stops requests', async () => {
    localStorage.setItem('gamification.enabled', 'false');
    const hit = vi.fn();
    server.use(http.get('/api/v1/progress', () => (hit(), HttpResponse.json(progress))));
    unplug = registerGamification();

    renderRoute(<OverviewPage />);
    expect(await screen.findByTestId('kpi-active')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-hero')).not.toBeInTheDocument();
    expect(hit).not.toHaveBeenCalled();
  });

  it('unplugging removes the slots again', async () => {
    server.use(http.get('/api/v1/progress', () => HttpResponse.json(progress)));
    registerGamification()();
    renderRoute(<OverviewPage />);
    expect(await screen.findByTestId('kpi-active')).toBeInTheDocument();
    expect(screen.queryByTestId('gm-hero')).not.toBeInTheDocument();
  });
});
