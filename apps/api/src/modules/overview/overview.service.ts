import type { OverviewDto } from '@job-tracker/shared';
import { buildOverview, type OverviewInput } from './build-overview.js';

export class OverviewService {
  constructor(
    private readonly repo: { load(now: Date): Promise<OverviewInput> },
    private readonly now: () => Date = () => new Date(),
  ) {}

  async get(): Promise<OverviewDto> {
    const at = this.now();
    return buildOverview(await this.repo.load(at), at);
  }
}
