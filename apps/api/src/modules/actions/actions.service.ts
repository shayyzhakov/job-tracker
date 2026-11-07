import { type ActionsDto, deriveActions } from '@job-tracker/shared';
import type { ActionsSource } from './actions.repository.js';

export class ActionsService {
  constructor(
    private readonly source: ActionsSource,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(): Promise<ActionsDto> {
    const { applications, interviews } = await this.source.load();
    return deriveActions({ applications, interviews, now: this.now() });
  }
}
