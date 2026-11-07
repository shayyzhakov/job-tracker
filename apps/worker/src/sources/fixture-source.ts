import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { type ListingSource, type RawListing, RawListingSchema } from '../types.js';

/** Reads listings from a JSON file: stands in for real job-board sources in development. */
export class FixtureSource implements ListingSource {
  readonly name = 'fixture';

  constructor(private readonly path: string) {}

  async fetchListings(): Promise<RawListing[]> {
    const json: unknown = JSON.parse(await readFile(this.path, 'utf8'));
    return z.array(RawListingSchema).parse(json);
  }
}
