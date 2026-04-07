import {
  ashbyOrgsFromEnv,
  fetchAdzuna,
  fetchArbeitnowFiltered,
  fetchAshbyOrgs,
  fetchGreenhouseBoards,
  fetchJobicyFiltered,
  fetchLeverSites,
  fetchRemotiveBatches,
  filterJobsByMaxAgeHours,
  greenhouseBoardsFromEnv,
  leverSitesFromEnv,
  mergeAndDedupeJobs,
  sortJobsByDate,
} from "@/lib/job-sources";
import type { JobRow } from "@/lib/jobs";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type JobFeedOptions = {
  sinceHours?: number;
  limit?: number;
};

export type JobFeedResult = {
  jobs: JobRow[];
  sources: string[];
  fetchedAt: string;
  meta: {
    adzuna: number;
    remotive: number;
    arbeitnow: number;
    jobicy: number;
    greenhouse: number;
    ashby: number;
    lever: number;
    merged: number;
    afterTimeFilter: number;
    sinceHours: number;
    limit: number;
    returned: number;
  };
};

export async function fetchJobsFeed(options: JobFeedOptions = {}): Promise<JobFeedResult> {
  const sinceHours = clamp(options.sinceHours ?? 24, 0, 24 * 30);
  const limit = clamp(options.limit ?? 100, 1, 300);

  const appId = process.env.ADZUNA_APP_ID ?? "";
  const appKey = process.env.ADZUNA_APP_KEY ?? "";

  const [
    adzuna,
    remotive,
    arbeitnow,
    jobicy,
    greenhouse,
    ashby,
    lever,
  ] = await Promise.all([
    fetchAdzuna(appId, appKey),
    fetchRemotiveBatches(),
    fetchArbeitnowFiltered(),
    fetchJobicyFiltered(),
    fetchGreenhouseBoards(greenhouseBoardsFromEnv()),
    fetchAshbyOrgs(ashbyOrgsFromEnv()),
    fetchLeverSites(leverSitesFromEnv()),
  ]);

  const merged = mergeAndDedupeJobs([
    ...adzuna,
    ...remotive,
    ...arbeitnow,
    ...jobicy,
    ...greenhouse,
    ...ashby,
    ...lever,
  ]);

  sortJobsByDate(merged);

  const mergedCount = merged.length;
  const timeFiltered = filterJobsByMaxAgeHours(merged, sinceHours);
  const jobs = timeFiltered.slice(0, limit);

  const sources = [
    adzuna.length && "Adzuna",
    remotive.length && "Remotive",
    arbeitnow.length && "Arbeitnow",
    jobicy.length && "Jobicy",
    greenhouse.length && "Greenhouse",
    ashby.length && "Ashby",
    lever.length && "Lever",
  ].filter(Boolean) as string[];

  return {
    jobs,
    sources,
    fetchedAt: new Date().toISOString(),
    meta: {
      adzuna: adzuna.length,
      remotive: remotive.length,
      arbeitnow: arbeitnow.length,
      jobicy: jobicy.length,
      greenhouse: greenhouse.length,
      ashby: ashby.length,
      lever: lever.length,
      merged: mergedCount,
      afterTimeFilter: timeFiltered.length,
      sinceHours,
      limit,
      returned: jobs.length,
    },
  };
}
