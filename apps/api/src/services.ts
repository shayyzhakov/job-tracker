// Composition root: wires repositories into the services that the REST routes and the MCP tools share.
import type { Db } from './db/dynamo.js';
import { DynamoActionsRepository } from './modules/actions/actions.repository.js';
import { ActionsService } from './modules/actions/actions.service.js';
import { DynamoApplicationsRepository } from './modules/applications/applications.repository.js';
import { ApplicationsService } from './modules/applications/applications.service.js';
import { DynamoCompaniesRepository } from './modules/companies/companies.repository.js';
import { CompaniesService } from './modules/companies/companies.service.js';
import { DynamoContactsRepository } from './modules/contacts/contacts.repository.js';
import { ContactsService } from './modules/contacts/contacts.service.js';
import { DynamoInterviewsRepository } from './modules/interviews/interviews.repository.js';
import { InterviewsService } from './modules/interviews/interviews.service.js';
import { DynamoNotesRepository } from './modules/notes/notes.repository.js';
import { NotesService } from './modules/notes/notes.service.js';
import { DynamoOpportunitiesRepository } from './modules/opportunities/opportunities.repository.js';
import { OpportunitiesService } from './modules/opportunities/opportunities.service.js';
import { DynamoOverviewRepository } from './modules/overview/overview.repository.js';
import { OverviewService } from './modules/overview/overview.service.js';
import {
  DynamoScoutCriteriaRepository,
  type ScoutCriteriaRepository,
} from './modules/scout-criteria/scout-criteria.repository.js';
import { DynamoTimelineRepository } from './modules/timeline/timeline.repository.js';

export interface Services {
  actions: ActionsService;
  applications: ApplicationsService;
  companies: CompaniesService;
  contacts: ContactsService;
  interviews: InterviewsService;
  notes: NotesService;
  overview: OverviewService;
  opportunities: OpportunitiesService;
  scoutCriteria: ScoutCriteriaRepository;
  timeline: DynamoTimelineRepository;
}

export function createServices(db: Db): Services {
  const companies = new DynamoCompaniesRepository(db);
  const applicationsRepo = new DynamoApplicationsRepository(db);
  const interviewsRepo = new DynamoInterviewsRepository(db);
  const applications = new ApplicationsService({
    applications: applicationsRepo,
    companies,
    interviews: interviewsRepo,
  });
  return {
    actions: new ActionsService(new DynamoActionsRepository(db, applicationsRepo)),
    applications,
    companies: new CompaniesService(companies),
    contacts: new ContactsService(new DynamoContactsRepository(db), applicationsRepo),
    interviews: new InterviewsService(interviewsRepo, applicationsRepo, applications),
    notes: new NotesService(new DynamoNotesRepository(db)),
    overview: new OverviewService(new DynamoOverviewRepository(db)),
    opportunities: new OpportunitiesService({
      opportunities: new DynamoOpportunitiesRepository(db),
      applications,
    }),
    scoutCriteria: new DynamoScoutCriteriaRepository(db),
    timeline: new DynamoTimelineRepository(db),
  };
}
