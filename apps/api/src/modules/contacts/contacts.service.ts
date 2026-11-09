import type {
  ContactAttach,
  ContactDetailDto,
  ContactDto,
  ContactUpdate,
} from '@job-tracker/shared';
import { NotFoundError } from '../../errors.js';
import type { ApplicationsRepository } from '../applications/applications.repository.js';
import type { DynamoContactsRepository } from './contacts.repository.js';

/**
 * Contacts are people shared across applications: one record per person, attached to each
 * application they appear on. Editing a contact changes it everywhere; removing it from an
 * application only detaches it (the last detach deletes the person).
 */
export class ContactsService {
  constructor(
    private readonly repo: DynamoContactsRepository,
    private readonly applications: Pick<ApplicationsRepository, 'getState'>,
  ) {}

  list(q?: string): Promise<ContactDto[]> {
    return this.repo.list(q);
  }

  async get(id: string): Promise<ContactDetailDto> {
    const contact = await this.repo.getDetail(id);
    if (!contact) throw new NotFoundError('Contact', id);
    return contact;
  }

  /** Attach by id, or by details (reusing a contact with the same email or LinkedIn profile). */
  async create(applicationId: string, input: ContactAttach): Promise<ContactDto> {
    if (!(await this.applications.getState(applicationId))) {
      throw new NotFoundError('Application', applicationId);
    }
    return this.repo.attach(applicationId, input);
  }

  async update(applicationId: string, id: string, patch: ContactUpdate): Promise<ContactDto> {
    const updated = await this.repo.update(applicationId, id, patch);
    if (!updated) throw new NotFoundError('Contact', id);
    return updated;
  }

  async remove(applicationId: string, id: string): Promise<void> {
    if (!(await this.repo.detach(applicationId, id))) throw new NotFoundError('Contact', id);
  }
}
