import { NextResponse, type NextRequest } from "next/server";
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

/** Build sırasında dış API çağrısı ve 2MB+ önbellek sorunlarını önler */
export const dynamic = "force-dynamic";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const sinceHours =
    sp.get("sinceHours") === null
      ? 24
      : clamp(Number(sp.get("sinceHours")) || 0, 0, 24 * 30);

  const limit = clamp(Number(sp.get("limit")) || 100, 1, 300);

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

  return NextResponse.json({
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
  });
}
