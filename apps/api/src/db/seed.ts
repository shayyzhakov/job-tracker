// Dev-only sample data: `pnpm db:seed` (wipes the dev DB first).
import { type ApplicationCreateInput, ApplicationCreateSchema } from '@job-tracker/shared';
import { sql } from 'drizzle-orm';
import { DrizzleApplicationsRepository } from '../modules/applications/applications.repository.js';
import { ApplicationsService } from '../modules/applications/applications.service.js';
import { DrizzleCompaniesRepository } from '../modules/companies/companies.repository.js';
import { DrizzleInterviewsRepository } from '../modules/interviews/interviews.repository.js';
import { createDb } from './client.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed in production');

const { db, close } = createDb(url);
const service = new ApplicationsService({
  applications: new DrizzleApplicationsRepository(db),
  companies: new DrizzleCompaniesRepository(db),
});
const interviews = new DrizzleInterviewsRepository(db);
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
}> = [
  {
    input: {
      company: { name: 'Nimbus Data', size: 'unicorn', isPublic: false, location: 'Tel Aviv' },
      roleName: 'Senior Backend Engineer',
      status: 'applied',
      appliedAt: at(-20),
      expectedSalaryIls: 42000,
      listingUrl: 'https://example.com/jobs/nimbus-1',
      contacts: [{ name: 'Noa Levi', role: 'Recruiter', email: 'noa@nimbus.example' }],
    },
    path: ['hr_screening', 'technical_interview'],
    interviewInDays: 2,
  },
  {
    input: {
      company: { name: 'Orbit Payments', size: 'startup', location: 'Herzliya' },
      roleName: 'Engineering Team Lead',
      isManagement: true,
      status: 'applied',
      appliedAt: at(-12),
      expectedSalaryIls: 48000,
      contacts: [
        { name: 'Yoni Cohen', role: 'VP R&D', phone: '+972-50-0000001' },
        { name: 'Maya Bar', role: 'Talent partner', email: 'maya@orbit.example' },
      ],
    },
    path: ['phone_interview'],
    interviewInDays: 5,
  },
  {
    input: {
      company: { name: 'Megacorp Systems', size: 'corporate', isPublic: true, location: 'Haifa' },
      roleName: 'Staff Software Engineer',
      status: 'applied',
      appliedAt: at(-30),
      expectedSalaryIls: 50000,
    },
    path: ['rejected'],
  },
  {
    input: {
      company: { name: 'Seedling AI', size: 'early_stage_startup', location: 'Remote' },
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
];

await db.execute(
  sql`truncate table status_history, interviews, contacts, applications, companies cascade`,
);
for (const { input, path = [], interviewInDays } of samples) {
  const { id } = await service.create(ApplicationCreateSchema.parse(input));
  for (const status of path) await service.changeStatus(id, status);
  if (interviewInDays !== undefined) {
    await interviews.create(id, { type: 'technical', scheduledAt: at(interviewInDays, 14) });
  }
}
console.log(`Seeded ${samples.length} applications`);
await close();
