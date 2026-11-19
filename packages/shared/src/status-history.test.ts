import { describe, expect, it } from 'vitest';
import type { ApplicationStatus } from './enums.js';
import { cleanHistory, rewriteHistory } from './status-history.js';

const rows = (...statuses: ApplicationStatus[]) =>
  statuses.map((toStatus, i) => ({
    id: `r${i}`,
    fromStatus: i === 0 ? null : statuses[i - 1],
    toStatus,
  }));
const ids = (list: { id: string }[]) => list.map((r) => r.id);

describe('rewriteHistory', () => {
  it('appends a step forward', () => {
    const r = rewriteHistory(rows('to_apply'), 'applied');
    expect(r).toMatchObject({ drop: [], append: true, from: 'to_apply' });
    expect(r.path).toEqual(['to_apply', 'applied']);
  });

  it('cuts a loop back to the first appearance, keeping that row', () => {
    const r = rewriteHistory(rows('to_apply', 'applied'), 'to_apply');
    expect(ids(r.drop)).toEqual(['r1']);
    expect(r.append).toBe(false);
    expect(r.path).toEqual(['to_apply']);
  });

  it('drops ghosted when the company answers after all', () => {
    const r = rewriteHistory(rows('to_apply', 'applied', 'ghosted'), 'applied');
    expect(ids(r.drop)).toEqual(['r2']);
    expect(r.path).toEqual(['to_apply', 'applied']);
  });

  it('replaces one closed outcome with another', () => {
    const r = rewriteHistory(rows('applied', 'ghosted'), 'rejected');
    expect(ids(r.drop)).toEqual(['r1']);
    expect(r).toMatchObject({ append: true, from: 'applied' });
    expect(r.path).toEqual(['applied', 'rejected']);
  });

  it('keeps the offer when it ends in a close', () => {
    const r = rewriteHistory(rows('applied', 'offer'), 'withdrawn');
    expect(r.drop).toEqual([]);
    expect(r.path).toEqual(['applied', 'offer', 'withdrawn']);
  });

  it('undoes a close when moving to offer', () => {
    const r = rewriteHistory(rows('applied', 'rejected'), 'offer');
    expect(ids(r.drop)).toEqual(['r1']);
    expect(r.path).toEqual(['applied', 'offer']);
  });

  it('undoes applied when going back to a not-submitted status never had', () => {
    const r = rewriteHistory(rows('applied'), 'on_hold');
    expect(ids(r.drop)).toEqual(['r0']);
    expect(r).toMatchObject({ append: true, from: null });
    expect(r.path).toEqual(['on_hold']);
  });

  it('keeps to apply before on hold (siblings)', () => {
    const r = rewriteHistory(rows('to_apply', 'applied'), 'on_hold');
    expect(ids(r.drop)).toEqual(['r1']);
    expect(r.path).toEqual(['to_apply', 'on_hold']);
  });

  it('never drops a legacy round row', () => {
    const r = rewriteHistory(rows('applied', 'phone_interview', 'ghosted'), 'applied');
    expect(ids(r.drop)).toEqual(['r2']);
  });
});

describe('cleanHistory', () => {
  it('collapses to apply → applied → to apply → X to to apply → X', () => {
    const history = rows('to_apply', 'applied', 'to_apply', 'on_hold');
    const r = cleanHistory(history);
    expect(ids(r.drop)).toEqual(['r1', 'r2']);
    // r3 already came from to apply, so nothing to relink.
    expect(r.relink).toEqual([]);
  });

  it('replaces ghosted by a later rejection', () => {
    const r = cleanHistory(rows('applied', 'ghosted', 'rejected'));
    expect(ids(r.drop)).toEqual(['r1']);
    expect(r.relink.map(({ row, fromStatus }) => [row.id, fromStatus])).toEqual([
      ['r2', 'applied'],
    ]);
  });

  it('rewrites applied → to apply → applied as to apply → applied', () => {
    const r = cleanHistory(rows('applied', 'to_apply', 'applied'));
    expect(ids(r.drop)).toEqual(['r0']);
    expect(r.relink.map(({ row, fromStatus }) => [row.id, fromStatus])).toEqual([['r1', null]]);
  });

  it('keeps a legacy round row as the row before the next one', () => {
    expect(cleanHistory(rows('technical_interview', 'rejected'))).toEqual({ drop: [], relink: [] });
  });

  it('leaves a logical history alone', () => {
    expect(cleanHistory(rows('to_apply', 'applied', 'offer', 'accepted'))).toEqual({
      drop: [],
      relink: [],
    });
  });
});
