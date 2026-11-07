// Shared logic for entities nested under an application (contacts, interviews),
// used by both the REST routes and the MCP tools.
import { NotFoundError } from '../errors.js';
import type { ApplicationsRepository } from './applications/applications.repository.js';

export interface ChildRepository<TInput, TUpdate, TDto> {
  create(applicationId: string, input: TInput): Promise<TDto>;
  /** Returns null when the child doesn't exist under this application. */
  update(applicationId: string, id: string, patch: TUpdate): Promise<TDto | null>;
  delete(applicationId: string, id: string): Promise<boolean>;
}

export class ChildService<TInput, TUpdate, TDto> {
  constructor(
    /** Display name used in errors, e.g. "Contact". */
    readonly entity: string,
    private readonly repo: ChildRepository<TInput, TUpdate, TDto>,
    private readonly applications: Pick<ApplicationsRepository, 'getState'>,
  ) {}

  async create(applicationId: string, input: TInput): Promise<TDto> {
    if (!(await this.applications.getState(applicationId))) {
      throw new NotFoundError('Application', applicationId);
    }
    return this.repo.create(applicationId, input);
  }

  async update(applicationId: string, id: string, patch: TUpdate): Promise<TDto> {
    const updated = await this.repo.update(applicationId, id, patch);
    if (!updated) throw new NotFoundError(this.entity, id);
    return updated;
  }

  async remove(applicationId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(applicationId, id))) throw new NotFoundError(this.entity, id);
  }
}
