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
  APPLICATION_STATUSES,
  INTERVIEW_TYPE_ROUND_STATUS,
  isActiveStatus,
  isRoundStatus,
  ROUND_STATUS_INTERVIEW_TYPE,
} from '@job-tracker/shared';
import { NotFoundError } from '../../errors.js';
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

  async create(input: ApplicationCreate): Promise<ApplicationDetailDto> {
    const company = await this.resolveCompany(input.company);
    const now = this.now();
    const { company: _company, contacts, appliedAt, ...fields } = input;
    const id = await this.apps.insert(
      {
        ...fields,
        companyId: company.id,
        appliedAt: appliedAt ?? (input.status === 'to_apply' ? null : now),
      },
      contacts,
      now,
    );
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
   * Moving to an interview-round stage records the interview itself (at `interviewAt`, default now),
   * so a round is one entity whether it is upcoming or already happened.
   */
  async changeStatus(
    id: string,
    status: ApplicationStatus,
    interviewAt?: Date,
    timeline: { replyBy?: Date; dueAt?: Date } = {},
  ): Promise<ApplicationDetailDto> {
    const state = await this.requireState(id);
    if (state.status !== status) {
      const now = this.now();
      const interview = isRoundStatus(status)
        ? await this.interviews.create(id, {
            type: ROUND_STATUS_INTERVIEW_TYPE[status],
            scheduledAt: interviewAt ?? now,
            timeUnknown: !interviewAt,
          })
        : null;
      await this.apps.changeStatus(id, {
        from: state.status,
        to: status,
        appliedAt: state.appliedAt ?? (status === 'to_apply' ? null : now),
        at: now,
        interviewId: interview?.id ?? null,
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

  /** An interview scheduled directly moves the application forward to that interview's stage. */
  async advanceToInterviewStage(id: string, interview: InterviewDto): Promise<void> {
    const to = INTERVIEW_TYPE_ROUND_STATUS[interview.type];
    const state = await this.apps.getState(id);
    if (!to || !state || !isActiveStatus(state.status)) return;
    if (APPLICATION_STATUSES.indexOf(to) <= APPLICATION_STATUSES.indexOf(state.status)) return;
    const now = this.now();
    await this.apps.changeStatus(id, {
      from: state.status,
      to,
      appliedAt: state.appliedAt ?? now,
      at: now,
      interviewId: interview.id,
    });
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
