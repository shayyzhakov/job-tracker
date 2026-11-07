import type { ApplicationDto, InterviewDto } from '../dto.js';
import { type ApplicationStatus, isActiveStatus, isRoundStatus } from '../enums.js';
import { dayKey } from '../gamification/engine.js';
import {
  ACTION_URGENCIES,
  type ActionDto,
  type ActionKind,
  type ActionsDto,
  type ActionUrgency,
  type WaitingDto,
} from './dto.js';
import { ACTION_RULES as R } from './rules.js';

export const ACTIONS_TIMEZONE = 'Asia/Jerusalem';

export interface DeriveActionsInput {
  applications: ApplicationDto[];
  interviews: InterviewDto[];
  now: Date;
  timeZone?: string;
}

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

type Outcome = { action: ActionDto } | { waiting: WaitingDto };

/** Whole calendar days from `from` to `to` in the timezone (negative when `to` is earlier). */
function dayDiff(from: Date, to: Date, tz: string): number {
  const a = Date.parse(`${dayKey(from, tz)}T00:00:00Z`);
  const b = Date.parse(`${dayKey(to, tz)}T00:00:00Z`);
  return Math.round((b - a) / DAY);
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const ago = (days: number) => (days <= 0 ? 'today' : `${plural(days, 'day')} ago`);

function clock(date: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** "today 14:00", "tomorrow 18:00", "in 5 days", "3 days ago". */
function when(date: Date, now: Date, tz: string): string {
  const d = dayDiff(now, date, tz);
  if (d === 0) return `today ${clock(date, tz)}`;
  if (d === 1) return `tomorrow ${clock(date, tz)}`;
  if (d > 1) return `in ${plural(d, 'day')}`;
  return `${plural(-d, 'day')} ago`;
}

const ageDays = (since: Date, now: Date, tz: string) => dayDiff(since, now, tz);

export function deriveActions(input: DeriveActionsInput): ActionsDto {
  const { applications, interviews, now } = input;
  const tz = input.timeZone ?? ACTIONS_TIMEZONE;

  const byApp = new Map<string, InterviewDto[]>();
  for (const i of interviews) {
    const list = byApp.get(i.applicationId) ?? [];
    list.push(i);
    byApp.set(i.applicationId, list);
  }

  const actions: ActionDto[] = [];
  const scheduled: WaitingDto[] = [];
  const waiting: WaitingDto[] = [];

  for (const app of applications) {
    if (!isActiveStatus(app.status)) continue;
    const out = evaluate(app, byApp.get(app.id) ?? [], now, tz);
    if (!out) continue;
    if ('action' in out) {
      const snoozedUntil = app.snoozedUntil ? new Date(app.snoozedUntil) : null;
      if (snoozedUntil && snoozedUntil > now) {
        waiting.push({
          applicationId: app.id,
          company: app.company.name,
          roleName: app.roleName,
          state: 'waiting',
          subtitle: `Snoozed until ${when(snoozedUntil, now, tz)}`,
          checkInAt: snoozedUntil.toISOString(),
        });
      } else actions.push(out.action);
    } else if (out.waiting.state === 'scheduled') scheduled.push(out.waiting);
    else waiting.push(out.waiting);
  }

  actions.sort(compareActions);
  scheduled.sort((a, b) => a.checkInAt.localeCompare(b.checkInAt));
  waiting.sort((a, b) => a.checkInAt.localeCompare(b.checkInAt));

  let hiddenNudges = 0;
  let nudgesShown = 0;
  const visible = actions.filter((a) => {
    if (a.urgency !== 'nudge') return true;
    if (nudgesShown < R.nudgeCap) {
      nudgesShown++;
      return true;
    }
    hiddenNudges++;
    return false;
  });

  return {
    needsYou: visible,
    scheduled,
    waiting,
    hiddenNudges,
    counts: {
      needsYou: actions.length,
      overdue: actions.filter((a) => a.urgency === 'overdue').length,
      waiting: waiting.length,
    },
  };
}

function compareActions(a: ActionDto, b: ActionDto): number {
  const u = ACTION_URGENCIES.indexOf(a.urgency) - ACTION_URGENCIES.indexOf(b.urgency);
  if (u !== 0) return u;
  // Within a tier the earliest date comes first: nearest deadline, or longest ignored.
  const at = (x: ActionDto) => (x.dueAt ? Date.parse(x.dueAt) : Number.POSITIVE_INFINITY);
  return at(a) - at(b) || a.company.localeCompare(b.company);
}

function evaluate(
  app: ApplicationDto,
  interviews: InterviewDto[],
  now: Date,
  tz: string,
): Outcome | null {
  const status: ApplicationStatus = app.status;
  const statusChangedAt = new Date(app.statusChangedAt);
  const handedOverAt =
    app.waitingOnThemAt && new Date(app.waitingOnThemAt) >= statusChangedAt
      ? new Date(app.waitingOnThemAt)
      : null;

  const base = { applicationId: app.id, company: app.company.name, roleName: app.roleName };
  const action = (
    kind: ActionKind,
    urgency: ActionUrgency,
    title: string,
    subtitle: string,
    dueAt: Date | null,
    interviewId: string | null = null,
  ): Outcome => ({
    action: {
      ...base,
      kind,
      urgency,
      title,
      subtitle,
      dueAt: dueAt?.toISOString() ?? null,
      interviewId,
    },
  });

  if (status === 'to_apply') {
    const age = ageDays(new Date(app.createdAt), now, tz);
    const urgency: ActionUrgency =
      age >= R.toApplyOverdueDays ? 'overdue' : age >= R.toApplySoonDays ? 'soon' : 'nudge';
    return action(
      'apply',
      urgency,
      `Apply to ${app.company.name} or drop it`,
      `In To apply for ${plural(age, 'day')}`,
      new Date(app.createdAt),
    );
  }

  if (status === 'offer') {
    const due = app.dueAt ? new Date(app.dueAt) : null;
    if (due) {
      const past = due < now;
      return action(
        'respond_offer',
        past ? 'overdue' : 'deadline',
        `Respond to the ${app.company.name} offer`,
        past ? `Offer expired ${when(due, now, tz)}` : `Offer expires ${when(due, now, tz)}`,
        due,
      );
    }
    const age = ageDays(statusChangedAt, now, tz);
    return action(
      'respond_offer',
      age >= R.offerOverdueDays ? 'overdue' : 'soon',
      `Respond to the ${app.company.name} offer`,
      `Offer received ${ago(age)}, no expiry set`,
      statusChangedAt,
    );
  }

  if (status === 'applied') {
    return waitOrFollowUp(app, handedOverAt ?? statusChangedAt, R.appliedStaleDays, now, tz, {
      ...base,
      label: `Applied ${ago(ageDays(statusChangedAt, now, tz))}`,
    });
  }

  if (status === 'home_assignment') {
    if (handedOverAt) {
      return waitOrFollowUp(app, handedOverAt, R.assignmentStaleDays, now, tz, {
        ...base,
        label: `Assignment submitted ${ago(ageDays(handedOverAt, now, tz))}`,
      });
    }
    const due = app.dueAt ? new Date(app.dueAt) : null;
    if (due) {
      return action(
        'submit_assignment',
        due < now ? 'overdue' : 'deadline',
        `Submit home assignment to ${app.company.name}`,
        due < now ? `Was due ${when(due, now, tz)}` : `Due ${when(due, now, tz)}`,
        due,
      );
    }
    const age = ageDays(statusChangedAt, now, tz);
    return action(
      'submit_assignment',
      age >= R.assignmentSoonDays ? 'soon' : 'nudge',
      `Submit home assignment to ${app.company.name}`,
      `Received ${ago(age)}, no due date set`,
      statusChangedAt,
    );
  }

  if (isRoundStatus(status)) {
    return evaluateRound(app, interviews, statusChangedAt, handedOverAt, now, tz, base, action);
  }
  return null;
}

function evaluateRound(
  app: ApplicationDto,
  interviews: InterviewDto[],
  statusChangedAt: Date,
  handedOverAt: Date | null,
  now: Date,
  tz: string,
  base: { applicationId: string; company: string; roleName: string },
  action: (
    kind: ActionKind,
    urgency: ActionUrgency,
    title: string,
    subtitle: string,
    dueAt: Date | null,
    interviewId?: string | null,
  ) => Outcome,
): Outcome {
  const real = interviews
    .filter((i) => !i.timeUnknown)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const endOf = (i: InterviewDto) =>
    new Date(Date.parse(i.scheduledAt) + (i.durationMinutes ?? R.defaultInterviewMinutes) * 60_000);

  const upcoming = real.find((i) => endOf(i) > now);
  if (upcoming) {
    const at = new Date(upcoming.scheduledAt);
    return {
      waiting: {
        ...base,
        state: 'scheduled',
        subtitle: `Interview ${when(at, now, tz)}`,
        checkInAt: at.toISOString(),
      },
    };
  }

  const held = real.filter((i) => endOf(i) <= now);
  const lastHeld = held.at(-1);
  if (lastHeld) {
    const heldAt = new Date(lastHeld.scheduledAt);
    const dayAfter = dayDiff(heldAt, now, tz) >= 1;
    if (!lastHeld.debriefedAt && dayAfter) {
      return action(
        'debrief',
        'soon',
        `Log how the ${app.company.name} interview went`,
        `Interview ${when(heldAt, now, tz)}`,
        heldAt,
        lastHeld.id,
      );
    }
    const start = handedOverAt && handedOverAt > heldAt ? handedOverAt : heldAt;
    const days =
      app.status === 'final_interview' ? R.finalInterviewStaleDays : R.interviewStaleDays;
    return waitOrFollowUp(app, start, days, now, tz, {
      ...base,
      label: `Interviewed ${ago(dayDiff(heldAt, now, tz))}`,
    });
  }

  // A round was reached but nobody has given a real time yet.
  if (handedOverAt) {
    return waitOrFollowUp(app, handedOverAt, R.schedulingStaleDays, now, tz, {
      ...base,
      label: 'Waiting for them to schedule',
    });
  }
  const age = ageDays(statusChangedAt, now, tz);
  return action(
    'schedule_interview',
    age >= R.scheduleSoonDays ? 'soon' : 'nudge',
    `Schedule or confirm the ${app.company.name} interview`,
    `Reached this stage ${ago(age)} with no interview time`,
    statusChangedAt,
  );
}

/** The employer's move: a waiting line until the timer runs out, then a follow-up (or ghosted) card. */
function waitOrFollowUp(
  app: ApplicationDto,
  start: Date,
  defaultDays: number,
  now: Date,
  tz: string,
  info: { applicationId: string; company: string; roleName: string; label: string },
): Outcome {
  const { label, ...base } = info;
  const replyBy = app.replyBy ? new Date(app.replyBy) : null;
  const days = app.followUps >= 1 ? R.followUpStaleDays : defaultDays;
  const checkIn = replyBy ?? new Date(start.getTime() + days * DAY);
  const stale = replyBy ? dayDiff(replyBy, now, tz) > 0 : now >= checkIn;

  if (!stale) {
    return {
      waiting: {
        ...base,
        state: 'waiting',
        subtitle: replyBy
          ? `${label} · they said by ${when(replyBy, now, tz).replace(/ \d\d:\d\d$/, '')}`
          : label,
        checkInAt: checkIn.toISOString(),
      },
    };
  }

  const overdueBy = Math.max(0, dayDiff(checkIn, now, tz));
  const urgency: ActionUrgency = overdueBy >= R.followUpOverdueDays ? 'overdue' : 'nudge';
  if (app.followUps >= R.ghostAfterFollowUps) {
    return {
      action: {
        ...base,
        kind: 'mark_ghosted',
        urgency: 'overdue',
        title: `No answer from ${app.company.name}. Mark as ghosted?`,
        subtitle: `${plural(app.followUps, 'follow-up')} sent, still nothing`,
        dueAt: checkIn.toISOString(),
        interviewId: null,
      },
    };
  }
  return {
    action: {
      ...base,
      kind: 'follow_up',
      urgency,
      title: `Follow up with ${app.company.name}`,
      subtitle: replyBy
        ? `They said they'd reply by ${when(replyBy, now, tz).replace(/ \d\d:\d\d$/, '')}`
        : label,
      dueAt: checkIn.toISOString(),
      interviewId: null,
    },
  };
}
