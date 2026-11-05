import type { ApplicationUpdate, CompanyDto, CompanyInput } from '@job-tracker/shared';
import { asc, eq, ilike, sql } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import { toCompanyDto } from '../../db/mappers.js';
import { companies } from '../../db/schema.js';

export type CompanyPatch = NonNullable<ApplicationUpdate['company']>;

export interface CompaniesRepository {
  findById(id: string): Promise<CompanyDto | null>;
  /** Case-insensitive exact match. */
  findByName(name: string): Promise<CompanyDto | null>;
  create(input: CompanyInput): Promise<CompanyDto>;
  update(id: string, patch: CompanyPatch): Promise<void>;
  search(q?: string): Promise<CompanyDto[]>;
}

export class DrizzleCompaniesRepository implements CompaniesRepository {
  constructor(private readonly db: Db) {}

  async findById(id: string) {
    const [row] = await this.db.select().from(companies).where(eq(companies.id, id));
    return row ? toCompanyDto(row) : null;
  }

  async findByName(name: string) {
    const [row] = await this.db
      .select()
      .from(companies)
      .where(sql`lower(${companies.name}) = lower(${name})`);
    return row ? toCompanyDto(row) : null;
  }

  async create(input: CompanyInput) {
    const [row] = await this.db.insert(companies).values(input).returning();
    if (!row) throw new Error('Failed to insert company');
    return toCompanyDto(row);
  }

  async update(id: string, patch: CompanyPatch) {
    if (Object.keys(patch).length === 0) return;
    await this.db.update(companies).set(patch).where(eq(companies.id, id));
  }

  async search(q?: string) {
    const rows = await this.db
      .select()
      .from(companies)
      .where(q ? ilike(companies.name, `%${q}%`) : undefined)
      .orderBy(asc(companies.name))
      .limit(50);
    return rows.map(toCompanyDto);
  }
}
