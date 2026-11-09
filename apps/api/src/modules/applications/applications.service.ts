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
} from '@job-tracker/shared';
import {
  INITIAL_STATUSES,
  isOpenStatus,
  isRoundStatus,
  ROUND_STATUS_INTERVIEW_TYPE,
} from '@job-tracker/shared';
import { ConflictError, NotFoundError } from '../../errors.js';
import type { CompaniesRepository } from '../companies/companies.repository.js';
import type { ApplicationsRepository } from './applications.repository.js';

export interface ApplicationsServiceDeps {
  applications: ApplicationsRepository;
  companies: CompaniesRepository;
  interviews: { create(applicationId: string, input: InterviewInput): Promise<InterviewDto> };
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
        appliedAt: appliedAt ?? (status === 'to_apply' ? null : now),
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
   * Only milestones (to apply, applied, offer, closed outcomes) are stored. Choosing a round adds the
   * interview behind it (at `interviewAt`, default now), and the round shown follows the interviews.
   */
  async changeStatus(
    id: string,
    status: ApplicationStatus,
    interviewAt?: Date,
    timeline: { replyBy?: Date; dueAt?: Date } = {},
  ): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    const now = this.now();
    if (isRoundStatus(status)) {
      await this.interviews.create(id, {
        type: ROUND_STATUS_INTERVIEW_TYPE[status],
        scheduledAt: interviewAt ?? now,
        timeUnknown: !interviewAt,
      });
      // Rounds need an applied application; picking one explicitly also reopens an offer or a close.
      if (state.status === 'to_apply' || !isOpenStatus(state.status) || state.status === 'offer') {
        await this.apps.changeStatus(id, {
          from: state.status,
          to: 'applied',
          appliedAt: state.appliedAt ?? now,
          at: now,
          replyBy: timeline.replyBy ?? null,
          dueAt: timeline.dueAt ?? null,
        });
      } else {
        await this.apps.recordActivity(id, {
          at: now,
          appliedAt: state.appliedAt ? null : now,
          replyBy: timeline.replyBy ?? null,
          dueAt: timeline.dueAt ?? null,
        });
      }
    } else if (state.status !== status) {
      if (
        (INITIAL_STATUSES as readonly ApplicationStatus[]).includes(status) &&
        (await this.get(id)).interviews.length > 0
      ) {
        throw new ConflictError('Remove the interviews before moving back to to apply or applied');
      }
      await this.apps.changeStatus(id, {
        from: state.status,
        to: status,
        appliedAt: state.appliedAt ?? (status === 'to_apply' ? null : now),
        at: now,
        replyBy: timeline.replyBy ?? null,
        dueAt: timeline.dueAt ?? null,
      });
    }
    return this.get(id);
  }

  async snooze(id: string, until: Date): Promise<ApplicationDetailDto> {
    if (!(await this.apps.snooze(id, until))) throw new NotFoundError('Application', id);
    return this.get(id);
  }

  async handOver(id: string, reason: HandOverReason): Promise<ApplicationDetailDto> {
    if (!(await this.apps.handOver(id, reason, this.now()))) {
      throw new NotFoundError('Application', id);
    }
    return this.get(id);
  }

  /**
   * A scheduled interview never writes a round status: the status shown follows the calendar. It does
   * make the application "applied", set the applied date, and restart the wait.
   */
  async onInterviewScheduled(id: string): Promise<void> {
    const state = await this.apps.getState(id);
    if (!state || !isOpenStatus(state.status) || state.status === 'offer') return;
    const now = this.now();
    if (state.status === 'to_apply') {
      await this.apps.changeStatus(id, {
        from: 'to_apply',
        to: 'applied',
        appliedAt: state.appliedAt ?? now,
        at: now,
      });
    } else {
      await this.apps.recordActivity(id, { at: now, appliedAt: state.appliedAt ? null : now });
    }
  }

  async remove(id: string): Promise<void> {
    if (!(await this.apps.delete(id))) throw new NotFoundError('Application', id);
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
