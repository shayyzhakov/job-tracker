import { APPLICATION_STATUSES, COMPANY_SIZES, INTERVIEW_TYPES } from '@job-tracker/shared';
import { relations, sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const applicationStatus = pgEnum('application_status', APPLICATION_STATUSES);
export const companySize = pgEnum('company_size', COMPANY_SIZES);
export const interviewType = pgEnum('interview_type', INTERVIEW_TYPES);

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const companies = pgTable(
  'companies',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    size: companySize(),
    isPublic: boolean().notNull().default(false),
    website: text(),
    location: text(),
    ...timestamps,
  },
  (t) => [uniqueIndex('companies_name_lower_idx').on(sql`lower(${t.name})`)],
);

export const applications = pgTable(
  'applications',
  {
    id: uuid().primaryKey().defaultRandom(),
    companyId: uuid()
      .notNull()
      .references(() => companies.id, { onDelete: 'restrict' }),
    roleName: text().notNull(),
    isManagement: boolean().notNull().default(false),
    status: applicationStatus().notNull().default('to_apply'),
    listingUrl: text(),
    /** Expected monthly gross base salary in ILS. */
    expectedSalaryIls: integer(),
    source: text(),
    notes: text(),
    appliedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index().on(t.status), index().on(t.companyId)],
);

export const contacts = pgTable(
  'contacts',
  {
    id: uuid().primaryKey().defaultRandom(),
    applicationId: uuid()
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    role: text(),
    email: text(),
    phone: text(),
    notes: text(),
    ...timestamps,
  },
  (t) => [index().on(t.applicationId)],
);

export const interviews = pgTable(
  'interviews',
  {
    id: uuid().primaryKey().defaultRandom(),
    applicationId: uuid()
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    type: interviewType().notNull().default('other'),
    scheduledAt: timestamp({ withTimezone: true }).notNull(),
    durationMinutes: integer(),
    location: text(),
    notes: text(),
    ...timestamps,
  },
  (t) => [index().on(t.applicationId), index().on(t.scheduledAt)],
);

export const statusHistory = pgTable(
  'status_history',
  {
    id: uuid().primaryKey().defaultRandom(),
    applicationId: uuid()
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    fromStatus: applicationStatus(),
    toStatus: applicationStatus().notNull(),
    changedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index().on(t.applicationId, t.changedAt)],
);

export const companiesRelations = relations(companies, ({ many }) => ({
  applications: many(applications),
}));
export const applicationsRelations = relations(applications, ({ one, many }) => ({
  company: one(companies, { fields: [applications.companyId], references: [companies.id] }),
  contacts: many(contacts),
  interviews: many(interviews),
  history: many(statusHistory),
}));
export const contactsRelations = relations(contacts, ({ one }) => ({
  application: one(applications, {
    fields: [contacts.applicationId],
    references: [applications.id],
  }),
}));
export const interviewsRelations = relations(interviews, ({ one }) => ({
  application: one(applications, {
    fields: [interviews.applicationId],
    references: [applications.id],
  }),
}));
export const statusHistoryRelations = relations(statusHistory, ({ one }) => ({
  application: one(applications, {
    fields: [statusHistory.applicationId],
    references: [applications.id],
  }),
}));
