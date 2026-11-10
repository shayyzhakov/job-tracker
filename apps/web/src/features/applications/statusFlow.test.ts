import { describe, expect, it } from 'vitest';
import { buildStatusFlow } from './statusFlow';

const NOW = Date.parse('2026-11-09T12:00:00.000Z');
const interview = (id: string, type: 'phone' | 'coffee' | 'other', scheduledAt: string) => ({
  id,
  applicationId: 'a',
  type,
  scheduledAt,
  durationMinutes: null,
  location: null,
  timeUnknown: false,
  debriefedAt: null,
});
const row = (
  id: string,
  fromStatus: 'applied' | 'to_apply' | 'rejected' | null,
  toStatus: 'to_apply' | 'applied' | 'offer' | 'rejected',
  changedAt: string,
  interviewId: string | null = null,
) => ({ id, applicationId: 'a', fromStatus, toStatus, changedAt, interviewId });

describe('buildStatusFlow', () => {
  it('shows Applied at the applied date even when the history has no row for it', () => {
    const flow = buildStatusFlow(
      {
        appliedAt: '2026-11-05T09:23:00.000Z',
        history: [],
        interviews: [
          interview('i1', 'phone', '2026-11-05T09:00:00.000Z'),
          interview('i2', 'phone', '2026-11-09T09:00:00.000Z'),
        ],
      },
      NOW,
    );
    expect(flow.map((s) => [s.title, s.scheduled])).toEqual([
      ['Phone interview', false],
      ['Applied', false],
      ['Phone interview', false],
    ]);
  });

  it('shows every milestone once, and rounds under their stage names', () => {
    const flow = buildStatusFlow(
      {
        appliedAt: '2026-11-03T00:00:00.000Z',
        history: [
          row('h1', null, 'to_apply', '2026-11-01T00:00:00.000Z'),
          row('h2', 'to_apply', 'applied', '2026-11-03T08:00:00.000Z'),
          row('h3', 'applied', 'offer', '2026-11-20T00:00:00.000Z'),
        ],
        interviews: [interview('i1', 'coffee', '2026-11-10T07:30:00.000Z')],
      },
      NOW,
    );
    expect(flow.map((s) => [s.title, s.scheduled])).toEqual([
      ['To apply', false],
      ['Applied', false],
      ['Coffee chat', true],
      ['Offer', true],
    ]);
  });

  it('shows an old round row that points at an interview once, as the interview, and unlinked ones as steps', () => {
    const flow = buildStatusFlow(
      {
        appliedAt: '2026-11-03T00:00:00.000Z',
        history: [
          row('h1', 'applied', 'offer', '2026-11-04T00:00:00.000Z', 'i1'),
          row('h2', 'applied', 'rejected', '2026-11-05T00:00:00.000Z'),
        ],
        interviews: [interview('i1', 'other', '2026-11-04T00:00:00.000Z')],
      },
      NOW,
    );
    expect(flow.map((s) => s.title)).toEqual(['Applied', 'Other interview', 'Rejected']);
  });

  it('keeps a re-applied row after a rejection', () => {
    const flow = buildStatusFlow(
      {
        appliedAt: '2026-11-03T00:00:00.000Z',
        history: [
          row('h1', null, 'applied', '2026-11-03T08:00:00.000Z'),
          row('h2', 'applied', 'rejected', '2026-11-04T00:00:00.000Z'),
          row('h3', 'rejected', 'applied', '2026-11-06T00:00:00.000Z'),
        ],
        interviews: [],
      },
      NOW,
    );
    expect(flow.map((s) => s.title)).toEqual(['Applied', 'Rejected', 'Applied']);
  });
});
