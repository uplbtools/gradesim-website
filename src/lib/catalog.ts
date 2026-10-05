// UPLB course catalog (offerings and requisites), generated in the extension repo
// by scratch/build_catalog.mjs from AMIS class listings. Do not edit by hand.
import catalogJson from './data/catalog.json';
import type { CatalogEntry } from './scheduler.ts';

export const UPLB_CATALOG = catalogJson as unknown as Record<string, CatalogEntry>;
