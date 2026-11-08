import type { NoteDto, NoteInput, NoteUpdate } from '@job-tracker/shared';
import { NotFoundError } from '../../errors.js';
import type { DynamoNotesRepository } from './notes.repository.js';

/** Notes belong to an interview, so they don't fit the generic ChildService (keyed on application only). */
export class NotesService {
  constructor(private readonly repo: DynamoNotesRepository) {}

  async create(applicationId: string, interviewId: string, input: NoteInput): Promise<NoteDto> {
    if (!(await this.repo.interviewExists(applicationId, interviewId))) {
      throw new NotFoundError('Interview', interviewId);
    }
    return this.repo.create(applicationId, interviewId, input.text);
  }

  async update(
    applicationId: string,
    interviewId: string,
    id: string,
    patch: NoteUpdate,
  ): Promise<NoteDto> {
    const updated = await this.repo.update(applicationId, interviewId, id, patch.text);
    if (!updated) throw new NotFoundError('Note', id);
    return updated;
  }

  async remove(applicationId: string, interviewId: string, id: string): Promise<void> {
    if (!(await this.repo.delete(applicationId, interviewId, id))) {
      throw new NotFoundError('Note', id);
    }
  }
}
