import { randomUUID } from 'node:crypto';
import {
  DeleteCommand,
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import {
  type ContactApplicationDto,
  type ContactAttach,
  type ContactDetailDto,
  type ContactDto,
  type ContactInput,
  type ContactUpdate,
  isContactRef,
} from '@job-tracker/shared';
import {
  batchGet,
  type Db,
  GSI2,
  isConditionFailed,
  iso,
  key,
  queryAll,
  queryGsi1,
  updateExisting,
} from '../../db/dynamo.js';
import {
  type ApplicationItem,
  type CompanyItem,
  type ContactItem,
  type ContactLinkItem,
  nul,
  toContactDto,
} from '../../db/mappers.js';
import { NotFoundError } from '../../errors.js';

/** A contact ready to attach: an existing person (`isNew = false`) or one still to be written. */
export interface ResolvedContact {
  item: ContactItem;
  isNew: boolean;
}

const CONTACTS_GSI1 = 'CONTACTS';
const gsiSortKey = (name: string, id: string) => `${name.toLowerCase()}#${id}`;

/** Lowercased host + path of a LinkedIn URL, without scheme, `www.`, query or trailing slash. */
export function normalizeLinkedin(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  } catch {
    return null;
  }
}

const sameEmail = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && a.toLowerCase() === b.toLowerCase();

/** The same person: same email, or the same LinkedIn profile. */
/** Digits only, with Israel's +972 prefix folded to a leading 0. Null when too short to identify anyone. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? '').replace(/\D/g, '').replace(/^972/, '0').replace(/^00/, '');
  return digits.length >= 7 ? digits : null;
}

type Identity = {
  email?: string | null;
  linkedinUrl?: string | null;
  phone?: string | null;
};
/** The same person: same email, LinkedIn profile or phone number. A name alone never counts. */
export const isSamePerson = (a: Identity, b: Identity) => {
  const la = normalizeLinkedin(a.linkedinUrl);
  const pa = normalizePhone(a.phone);
  return (
    sameEmail(a.email, b.email) ||
    (!!la && la === normalizeLinkedin(b.linkedinUrl)) ||
    (!!pa && pa === normalizePhone(b.phone))
  );
};

const profileItem = (id: string, c: ContactInput, at: string): ContactItem => ({
  id,
  name: c.name,
  role: nul(c.role),
  email: nul(c.email),
  phone: nul(c.phone),
  linkedinUrl: nul(c.linkedinUrl),
  notes: nul(c.notes),
  createdAt: at,
  updatedAt: at,
});

export class DynamoContactsRepository {
  constructor(private readonly db: Db) {}

  private allItems() {
    return queryGsi1<ContactItem>(this.db, CONTACTS_GSI1);
  }

  /** Number of applications each contact is attached to. */
  async applicationCounts(ids: string[]): Promise<Map<string, number>> {
    const counts = await Promise.all(
      ids.map(async (id) => {
        const res = await this.db.doc.send(
          new QueryCommand({
            TableName: this.db.table,
            IndexName: GSI2,
            KeyConditionExpression: 'GSI2PK = :pk',
            ExpressionAttributeValues: { ':pk': `CONTACT#${id}` },
            Select: 'COUNT',
          }),
        );
        return [id, res.Count ?? 0] as const;
      }),
    );
    return new Map(counts);
  }

  /** Every contact, by name, optionally filtered on name, role, email or phone. */
  async list(q?: string): Promise<ContactDto[]> {
    const needle = q?.toLowerCase();
    const items = (await this.allItems()).filter(
      (c) =>
        !needle ||
        [c.name, c.role, c.email, c.phone].some((f) => f?.toLowerCase().includes(needle)),
    );
    const counts = await this.applicationCounts(items.map((c) => c.id));
    return items.map((c) => toContactDto(c, counts.get(c.id) ?? 0));
  }

  async get(id: string): Promise<ContactDto | null> {
    const res = await this.db.doc.send(
      new GetCommand({ TableName: this.db.table, Key: key.contact(id) }),
    );
    const item = res.Item as ContactItem | undefined;
    if (!item) return null;
    return toContactDto(item, (await this.applicationCounts([id])).get(id) ?? 0);
  }

  /** One contact with the applications it is attached to (newest first). Null when unknown. */
  async getDetail(id: string): Promise<ContactDetailDto | null> {
    const contact = await this.get(id);
    if (!contact) return null;
    const links = await queryAll<ContactLinkItem>(this.db, {
      IndexName: GSI2,
      KeyConditionExpression: 'GSI2PK = :pk',
      ExpressionAttributeValues: { ':pk': `CONTACT#${id}` },
    });
    const apps = await batchGet<ApplicationItem>(
      this.db,
      links.map((l) => key.app(l.applicationId)),
    );
    const companies = await batchGet<CompanyItem>(
      this.db,
      [...new Set(apps.map((a) => a.companyId))].map((c) => key.company(c)),
    );
    const companyName = new Map(companies.map((c) => [c.id, c.name]));
    const applications = apps
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(
        (a): ContactApplicationDto => ({
          id: a.id,
          roleName: a.roleName,
          status: a.status,
          companyName: companyName.get(a.companyId) ?? '',
        }),
      );
    return { ...contact, applications };
  }

  /**
   * Turns attach requests into contacts: a reference must exist, new details that match an existing
   * person (same email or LinkedIn profile) reuse that person, anything else becomes a new contact.
   * Nothing is written here. The same person never appears twice in the result.
   */
  async resolve(inputs: ContactAttach[], at: Date): Promise<ResolvedContact[]> {
    if (inputs.length === 0) return [];
    const known = await this.allItems();
    const resolved: ResolvedContact[] = [];
    for (const [i, input] of inputs.entries()) {
      let match: ResolvedContact | undefined;
      if (isContactRef(input)) {
        const item = known.find((c) => c.id === input.contactId);
        if (!item) throw new NotFoundError('Contact', input.contactId);
        match = resolved.find((r) => r.item.id === item.id) ?? {
          item,
          isNew: false,
        };
      } else {
        const item = known.find((c) => isSamePerson(c, input));
        match = item
          ? (resolved.find((r) => r.item.id === item.id) ?? {
              item,
              isNew: false,
            })
          : {
              // Offset by 1ms per contact to keep input order stable.
              item: profileItem(randomUUID(), input, iso(new Date(at.getTime() + i))),
              isNew: true,
            };
        if (!item) known.push(match.item);
      }
      if (!resolved.includes(match)) resolved.push(match);
    }
    return resolved;
  }

  /** Transaction items that write new contacts and attach every resolved contact to the application. */
  attachItems(applicationId: string, resolved: ResolvedContact[], at: Date) {
    return resolved.flatMap(({ item, isNew }, i) => {
      const link: ContactLinkItem = {
        id: item.id,
        applicationId,
        createdAt: iso(new Date(at.getTime() + i)),
      };
      return [
        ...(isNew
          ? [
              {
                Put: {
                  TableName: this.db.table,
                  Item: {
                    ...key.contact(item.id),
                    GSI1PK: CONTACTS_GSI1,
                    GSI1SK: gsiSortKey(item.name, item.id),
                    ...item,
                  },
                },
              },
            ]
          : []),
        {
          Put: {
            TableName: this.db.table,
            Item: {
              ...key.contactLink(applicationId, item.id),
              GSI2PK: `CONTACT#${item.id}`,
              GSI2SK: applicationId,
              ...link,
            },
          },
        },
      ];
    });
  }

  async isAttached(applicationId: string, id: string) {
    const res = await this.db.doc.send(
      new GetCommand({
        TableName: this.db.table,
        Key: key.contactLink(applicationId, id),
      }),
    );
    return !!res.Item;
  }

  /** Attaches a contact to an existing application. Attaching the same contact twice is a no-op. */
  async attach(applicationId: string, input: ContactAttach): Promise<ContactDto> {
    const now = new Date();
    const [contact] = await this.resolve([input], now);
    if (!contact) throw new NotFoundError('Contact', '');
    if (!(await this.isAttached(applicationId, contact.item.id))) {
      await this.db.doc.send(
        new TransactWriteCommand({
          TransactItems: this.attachItems(applicationId, [contact], now),
        }),
      );
    }
    const counts = await this.applicationCounts([contact.item.id]);
    return toContactDto(contact.item, counts.get(contact.item.id) ?? 0);
  }

  /** Edits the shared contact, so the change shows on every application. Null when not attached here. */
  async update(applicationId: string, id: string, patch: ContactUpdate) {
    if (!(await this.isAttached(applicationId, id))) return null;
    const set = Object.keys(patch).length > 0 ? { ...patch, updatedAt: iso(new Date()) } : {};
    const item = await updateExisting<ContactItem>(this.db, key.contact(id), {
      ...set,
      ...(patch.name !== undefined && { GSI1SK: gsiSortKey(patch.name, id) }),
    });
    if (!item) return null;
    return toContactDto(item, (await this.applicationCounts([id])).get(id) ?? 0);
  }

  /** Detaches the contact from the application; a contact left on no application is deleted. */
  async detach(applicationId: string, id: string) {
    try {
      await this.db.doc.send(
        new DeleteCommand({
          TableName: this.db.table,
          Key: key.contactLink(applicationId, id),
          ConditionExpression: 'attribute_exists(PK)',
        }),
      );
    } catch (err) {
      if (isConditionFailed(err)) return false;
      throw err;
    }
    await this.deleteOrphans([id]);
    return true;
  }

  /** Deletes the given contacts that are no longer attached to any application. */
  async deleteOrphans(ids: string[]) {
    const counts = await this.applicationCounts(ids);
    await Promise.all(
      ids
        .filter((id) => (counts.get(id) ?? 0) === 0)
        .map((id) =>
          this.db.doc.send(
            new DeleteCommand({
              TableName: this.db.table,
              Key: key.contact(id),
            }),
          ),
        ),
    );
  }
}
