import type {
  ApplicationCreate,
  ApplicationDetailDto,
  ApplicationListQuery,
  ApplicationStatus,
  ApplicationUpdate,
  CompanyDto,
  HandOverReason,
  InterviewDto,
  InterviewInput,
  InterviewUpdate,
} from '@job-tracker/shared';
import {
  currentRound,
  INITIAL_STATUSES,
  isNotSubmittedStatus,
  isOpenStatus,
  isRoundStatus,
  ROUND_STATUS_INTERVIEW_TYPE,
  rewriteHistory,
} from '@job-tracker/shared';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { CompaniesRepository } from '../companies/companies.repository.js';
import type { ApplicationsRepository } from './applications.repository.js';

export interface ApplicationsServiceDeps {
  applications: ApplicationsRepository;
  companies: CompaniesRepository;
  interviews: {
    create(applicationId: string, input: InterviewInput): Promise<InterviewDto>;
    update(applicationId: string, id: string, patch: InterviewUpdate): Promise<InterviewDto | null>;
  };
  now?: () => Date;
}

export class ApplicationsService {
  private readonly apps: ApplicationsRepository;
  private readonly companies: CompaniesRepository;
  private readonly interviews: ApplicationsServiceDeps['interviews'];
  private readonly now: () => Date;

  constructor({
    applications,
    companies,
    interviews,
    now = () => new Date(),
  }: ApplicationsServiceDeps) {
    this.apps = applications;
    this.companies = companies;
    this.interviews = interviews;
    this.now = now;
  }

  list(query: ApplicationListQuery) {
    return this.apps.list(query);
  }

  async get(id: string): Promise<ApplicationDetailDto> {
    const app = await this.apps.findById(id);
    if (!app) throw new NotFoundError('Application', id);
    return app;
  }

  /** A round status is never stored: it becomes "applied" plus the interview behind it. */
  async create(input: ApplicationCreate): Promise<ApplicationDetailDto> {
    const company = await this.resolveCompany(input.company);
    const now = this.now();
    const { company: _company, contacts, appliedAt, ...fields } = input;
    const round = isRoundStatus(input.status) ? input.status : null;
    const status = round ? 'applied' : input.status;
    const id = await this.apps.insert(
      {
        ...fields,
        status,
        companyId: company.id,
        appliedAt: appliedAt ?? (isNotSubmittedStatus(status) ? null : now),
      },
      contacts,
      now,
    );
    if (round) {
      await this.interviews.create(id, {
        type: ROUND_STATUS_INTERVIEW_TYPE[round],
        scheduledAt: now,
        timeUnknown: true,
      });
    }
    return this.get(id);
  }

  async update(id: string, patch: ApplicationUpdate): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    const { company, ...fields } = patch;
    if (company) await this.companies.update(state.companyId, company);
    await this.apps.update(id, fields);
    return this.get(id);
  }

  /**
   * Only milestones (to apply, on hold, applied, offer, closed outcomes) are stored. Choosing a round adds the
   * interview behind it (at `interviewAt`, default now), and the round shown follows the interviews.
   * The round's timeline (next step, and a due date for a home assignment) goes on that interview;
   * an offer's expiry goes on the application.
   */
  async changeStatus(
    id: string,
    status: ApplicationStatus,
    interviewAt?: Date,
    timeline: { nextStep?: string; dueAt?: Date; offerExpiresAt?: Date } = {},
  ): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    const now = this.now();
    if (isRoundStatus(status)) {
      const type = ROUND_STATUS_INTERVIEW_TYPE[status];
      await this.interviews.create(id, {
        type,
        scheduledAt: interviewAt ?? now,
        timeUnknown: !interviewAt,
        nextStep: timeline.nextStep,
        dueAt: type === 'home_assignment' ? timeline.dueAt : undefined,
      });
      // Rounds need an applied application; picking one explicitly also reopens a close. At offer the
      // round is just added (a last chat before signing): the offer stays.
      if (isNotSubmittedStatus(state.status) || !isOpenStatus(state.status)) {
        await this.moveTo(id, 'applied', { appliedAt: state.appliedAt ?? now, at: now });
      } else if (state.status !== 'offer') {
        await this.apps.recordActivity(id, {
          at: now,
          appliedAt: state.appliedAt ? null : now,
        });
      }
    } else if (state.status !== status) {
      if (
        (INITIAL_STATUSES as readonly ApplicationStatus[]).includes(status) &&
        (await this.get(id)).interviews.length > 0
      ) {
        throw new ConflictError(
          'Remove the interviews before moving back to to apply, on hold or applied',
        );
      }
      await this.moveTo(id, status, {
        // Back to not submitted (only possible without interviews) undoes applying, so its date goes too.
        appliedAt: isNotSubmittedStatus(status) ? null : (state.appliedAt ?? now),
        at: now,
        offerExpiresAt: timeline.offerExpiresAt ?? null,
      });
    } else if (status === 'offer' && timeline.offerExpiresAt) {
      await this.apps.update(id, { offerExpiresAt: timeline.offerExpiresAt });
    }
    return this.get(id);
  }

  async snooze(id: string, until: Date): Promise<ApplicationDetailDto> {
    if (!(await this.apps.snooze(id, until))) throw new NotFoundError('Application', id);
    return this.get(id);
  }

  /**
   * "Submitted" marks the open home assignment submitted (the round ends then). Any other hand-over,
   * or "submitted" with no open assignment, records that the ball is with the employer.
   */
  async handOver(id: string, reason: HandOverReason): Promise<ApplicationDetailDto> {
    const now = this.now();
    if (reason === 'submitted') {
      const app = await this.get(id);
      const round = currentRound(app.interviews, now);
      if (round?.phase === 'open') {
        await this.interviews.update(id, round.interview.id, { submittedAt: now });
        return this.get(id);
      }
    }
    if (!(await this.apps.handOver(id, reason, now))) {
      throw new NotFoundError('Application', id);
    }
    return this.get(id);
  }

  /**
   * A scheduled interview never writes a round status: the status shown follows the calendar. It does
   * make the application "applied", set the applied date, and restart the wait. A future interview on a
   * ghosted application means they came back: it reopens it (and ghosted leaves the history).
   */
  async onInterviewScheduled(id: string, scheduledAt?: Date): Promise<void> {
    const state = await this.apps.getState(id);
    if (!state) return;
    const now = this.now();
    if (state.status === 'ghosted' && scheduledAt && scheduledAt.getTime() > now.getTime()) {
      await this.moveTo(id, 'applied', { appliedAt: state.appliedAt ?? now, at: now });
      return;
    }
    if (!isOpenStatus(state.status) || state.status === 'offer') return;
    if (isNotSubmittedStatus(state.status)) {
      await this.moveTo(id, 'applied', { appliedAt: state.appliedAt ?? now, at: now });
    } else {
      await this.apps.recordActivity(id, { at: now, appliedAt: state.appliedAt ? null : now });
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.apps.delete(id))) throw new NotFoundError('Application', id);
  }

  /** Changes a stored status, keeping the history one logical path (see `rewriteHistory`). */
  private async moveTo(
    id: string,
    to: ApplicationStatus,
    fields: { appliedAt: Date | null; at: Date; offerExpiresAt?: Date | null },
  ): Promise<void> {
    const { history } = await this.get(id);
    const rewrite = rewriteHistory(history, to);
    await this.apps.changeStatus(id, {
      ...fields,
      from: rewrite.from,
      to,
      rewrite,
    });
  }

  private async requireState(id: string) {
    const state = await this.apps.getState(id);
    if (!state) throw new NotFoundError('Application', id);
    return state;
  }

  private async resolveCompany(ref: ApplicationCreate['company']): Promise<CompanyDto> {
    if ('id' in ref) {
      const found = await this.companies.findById(ref.id);
      if (!found) throw new NotFoundError('Company', ref.id);
      return found;
    }
    return (await this.companies.findByName(ref.name)) ?? this.companies.create(ref);
  }
}
