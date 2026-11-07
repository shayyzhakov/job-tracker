// Dev-only sample data: `pnpm db:seed` (wipes the dev table first; DynamoDB Local only).
import { type ApplicationCreateInput, ApplicationCreateSchema } from '@job-tracker/shared';
import { DynamoApplicationsRepository } from '../modules/applications/applications.repository.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { DynamoCompaniesRepository } from '../modules/companies/companies.repository.js';
import { DynamoInterviewsRepository } from '../modules/interviews/interviews.repository.js';
import { clearTable } from './clear.js';
import { createDb, resolveDbConfig } from './dynamo.js';
import { ensureTable } from './table.js';

const config = resolveDbConfig();
if (process.env.NODE_ENV === 'production' || !config.endpoint) {
  throw new Error('Refusing to seed: only DynamoDB Local (DYNAMODB_ENDPOINT) can be seeded');
}
await ensureTable(config);
const { db, close } = createDb(config);
const service = new ApplicationsService({
  applications: new DynamoApplicationsRepository(db),
  companies: new DynamoCompaniesRepository(db),
  interviews: new DynamoInterviewsRepository(db),
});
const day = 86_400_000;
const at = (days: number, hour = 10) => {
  const d = new Date(Date.now() + days * day);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const samples: Array<{
  input: ApplicationCreateInput;
  path?: Parameters<ApplicationsService['changeStatus']>[1][];
  interviewInDays?: number;
  /** Replies/deadlines for the last status in `path`. */
  timeline?: { replyBy?: Date; dueAt?: Date };
  /** An interview round at a given offset (negative = already happened), after `path`. */
  round?: { status: Parameters<ApplicationsService['changeStatus']>[1]; days: number };
}> = [
  {
    input: {
      company: {
        name: 'Nimbus Data',
        size: 'unicorn',
        isPublic: false,
        location: 'Tel Aviv',
      },
      roleName: 'Senior Backend Engineer',
      status: 'applied',
      appliedAt: at(-20),
      expectedSalaryIls: 42000,
      listingUrl: 'https://example.com/jobs/nimbus-1',
      contacts: [
        {
          name: 'Noa Levi',
          role: 'Recruiter',
          email: 'noa@nimbus.example',
          linkedinUrl: 'https://www.linkedin.com/in/noa-levi-example',
        },
      ],
    },
    path: ['hr_screening', 'technical_interview'],
    interviewInDays: 2,
  },
  {
    input: {
      company: {
        name: 'Orbit Payments',
        size: 'startup',
        location: 'Herzliya',
      },
      roleName: 'Engineering Team Lead',
      isManagement: true,
      status: 'applied',
      appliedAt: at(-12),
      expectedSalaryIls: 48000,
      contacts: [
        { name: 'Yoni Cohen', role: 'VP R&D', phone: '+972-50-0000001' },
        {
          name: 'Maya Bar',
          role: 'Talent partner',
          email: 'maya@orbit.example',
        },
      ],
    },
    path: ['phone_interview'],
    interviewInDays: 5,
  },
  {
    input: {
      company: {
        name: 'Megacorp Systems',
        size: 'corporate',
        isPublic: true,
        location: 'Haifa',
      },
      roleName: 'Staff Software Engineer',
      status: 'applied',
      appliedAt: at(-30),
      expectedSalaryIls: 50000,
    },
    path: ['rejected'],
  },
  {
    input: {
      company: {
        name: 'Seedling AI',
        size: 'early_stage_startup',
        location: 'Remote',
      },
      roleName: 'Founding Engineer',
      status: 'to_apply',
      notes: 'Ask about equity and runway',
    },
  },
  {
    input: {
      company: { name: 'Quantra', size: 'startup', location: 'Tel Aviv' },
      roleName: 'Full Stack Engineer',
      status: 'applied',
      appliedAt: at(-4),
      expectedSalaryIls: 38000,
    },
  },
  // Action-queue samples: each lands in a different part of the Tasks list.
  {
    input: {
      company: { name: 'Helix Labs', size: 'startup', location: 'Ramat Gan' },
      roleName: 'Backend Developer',
      status: 'applied',
      appliedAt: at(-22),
    },
  },
  {
    input: {
      company: { name: 'Vertex Pay', size: 'unicorn', location: 'Tel Aviv' },
      roleName: 'Senior Engineer',
      status: 'applied',
      appliedAt: at(-30),
      expectedSalaryIls: 45000,
    },
    path: ['offer'],
    timeline: { dueAt: at(2, 18) },
  },
  {
    input: {
      company: { name: 'Lumen Labs', size: 'startup', location: 'Jerusalem' },
      roleName: 'Platform Engineer',
      status: 'applied',
      appliedAt: at(-9),
    },
    path: ['home_assignment'],
    timeline: { dueAt: at(1, 18) },
  },
  {
    input: {
      company: { name: 'Kite Security', size: 'startup', location: 'Tel Aviv' },
      roleName: 'Security Engineer',
      status: 'applied',
      appliedAt: at(-8),
    },
    round: { status: 'phone_interview', days: -2 },
  },
];

await clearTable(db);
for (const { input, path = [], interviewInDays, timeline, round } of samples) {
  const { id } = await service.create(ApplicationCreateSchema.parse(input));
  for (const [i, status] of path.entries()) {
    const last = i === path.length - 1;
    await service.changeStatus(id, status, undefined, last ? timeline : undefined);
  }
  if (round) await service.changeStatus(id, round.status, at(round.days, 14));
  // The upcoming technical round is a status step too: it creates the interview record.
  if (interviewInDays !== undefined) {
    await service.changeStatus(id, 'technical_interview', at(interviewInDays, 14));
  }
}
console.log(`Seeded ${samples.length} applications`);
await close();
