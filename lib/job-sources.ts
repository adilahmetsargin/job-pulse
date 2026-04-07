import {
  normalizeAdzuna,
  normalizeArbeitnow,
  normalizeAshby,
  normalizeGreenhouse,
  normalizeJobicy,
  normalizeLever,
  normalizeRemotive,
  type JobRow,
  type LeverPosting,
  type RemotiveJob,
} from "@/lib/jobs";

export const SEARCH_TERMS = [
  "react",
  "frontend",
  "typescript",
  "next.js",
  "javascript engineer",
];

const REVALIDATE = 300;

function smallFetchInit(): RequestInit {
  return {
    next: { revalidate: REVALIDATE },
    headers: { Accept: "application/json" },
  };
}

/** Büyük gövdeler (Ashby açıklama HTML) Next fetch önbelleğini 2MB aşmasın diye. */
function uncachedFetchInit(): RequestInit {
  return {
    cache: "no-store" as RequestCache,
    headers: { Accept: "application/json" },
  };
}

const TECH_TITLE =
  /react|frontend|typescript|javascript|next\.?\s*js|vue\.?js|\bvue\b|svelte|angular|web\s*(dev|engineer)|ui\s*engineer|full[\s-]?stack|software\s*engineer|developer/i;

export function matchesDevInterest(title: string): boolean {
  return TECH_TITLE.test(title);
}

const DEFAULT_GREENHOUSE_BOARDS = [
  "stripe",
  "airbnb",
  "anthropic",
  "discord",
  "dropbox",
  "figma",
  "duolingo",
  "databricks",
  "cloudflare",
];

const DEFAULT_ASHBY_ORGS = ["notion", "ramp", "cursor", "linear"];

export async function fetchAdzuna(appId: string, appKey: string): Promise<JobRow[]> {
  if (!appId || !appKey) return [];

  const perTerm = await Promise.all(
    SEARCH_TERMS.map(async (what) => {
      const url = new URL("https://api.adzuna.com/v1/api/jobs/us/search/1");
      url.searchParams.set("app_id", appId);
      url.searchParams.set("app_key", appKey);
      url.searchParams.set("what", what);
      url.searchParams.set("results_per_page", "20");
      const res = await fetch(url.toString(), smallFetchInit());
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: unknown[] };
      const results = data.results ?? [];
      return results.map((r) => normalizeAdzuna(r as Parameters<typeof normalizeAdzuna>[0]));
    }),
  );

  const seen = new Set<string>();
  const out: JobRow[] = [];
  for (const batch of perTerm) {
    for (const j of batch) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      out.push(j);
    }
  }
  return out;
}

export async function fetchRemotiveBatches(): Promise<JobRow[]> {
  const seen = new Set<number>();
  const merged: RemotiveJob[] = [];

  await Promise.all(
    SEARCH_TERMS.map(async (search) => {
      const url = `https://remotive.com/api/remote-jobs?search=${encodeURIComponent(search)}`;
      const res = await fetch(url, smallFetchInit());
      if (!res.ok) return;
      const data = (await res.json()) as { jobs?: RemotiveJob[] };
      for (const j of data.jobs ?? []) {
        if (seen.has(j.id)) continue;
        seen.add(j.id);
        merged.push(j);
      }
    }),
  );

  return merged.map(normalizeRemotive);
}

export async function fetchArbeitnowFiltered(): Promise<JobRow[]> {
  const res = await fetch("https://www.arbeitnow.com/api/job-board-api", smallFetchInit());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    data?: Array<Parameters<typeof normalizeArbeitnow>[0]>;
  };
  const rows = (data.data ?? [])
    .filter((j) => matchesDevInterest(j.title))
    .map(normalizeArbeitnow);
  return rows;
}

export async function fetchJobicyFiltered(): Promise<JobRow[]> {
  const url = "https://jobicy.com/api/v2/remote-jobs?count=40";
  const res = await fetch(url, smallFetchInit());
  if (!res.ok) return [];
  const data = (await res.json()) as {
    jobs?: Array<Parameters<typeof normalizeJobicy>[0]>;
  };
  return (data.jobs ?? [])
    .filter((j) => matchesDevInterest(j.jobTitle))
    .map(normalizeJobicy);
}

export async function fetchGreenhouseBoards(boards: string[]): Promise<JobRow[]> {
  const lists = await Promise.all(
    boards.map(async (board) => {
      const res = await fetch(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`,
        smallFetchInit(),
      );
      if (!res.ok) return [] as JobRow[];
      const data = (await res.json()) as {
        jobs?: Array<Parameters<typeof normalizeGreenhouse>[1]>;
      };
      return (data.jobs ?? [])
        .filter((j) => matchesDevInterest(j.title))
        .map((j) => normalizeGreenhouse(board, j));
    }),
  );
  return lists.flat();
}

type AshbyBoardResponse = {
  jobs?: Array<{
    id: string;
    title: string;
    jobUrl: string;
    department?: string;
    team?: string;
    employmentType?: string;
    publishedAt?: string;
    workplaceType?: string;
    location?: string;
    isRemote?: boolean;
    isListed?: boolean;
  }>;
};

export async function fetchAshbyOrgs(orgs: string[]): Promise<JobRow[]> {
  const lists = await Promise.all(
    orgs.map(async (org) => {
      const res = await fetch(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`,
        uncachedFetchInit(),
      );
      if (!res.ok) return [] as JobRow[];
      const data = (await res.json()) as AshbyBoardResponse;
      return (data.jobs ?? [])
        .filter((j) => j.isListed !== false)
        .filter((j) => matchesDevInterest(j.title))
        .map((j) => normalizeAshby(org, j));
    }),
  );
  return lists.flat();
}

async function fetchLeverSite(site: string): Promise<JobRow[]> {
  const res = await fetch(
    `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?limit=100`,
    smallFetchInit(),
  );
  if (!res.ok) return [];
  const data: unknown = await res.json();
  if (data && typeof data === "object" && "ok" in data && (data as { ok: boolean }).ok === false) {
    return [];
  }
  if (!Array.isArray(data)) return [];
  return (data as LeverPosting[])
    .filter((p) => matchesDevInterest(p.text))
    .map((p) => normalizeLever(site, p));
}

export async function fetchLeverSites(sites: string[]): Promise<JobRow[]> {
  if (!sites.length) return [];
  const lists = await Promise.all(sites.map((s) => fetchLeverSite(s.trim()).catch(() => [])));
  return lists.flat();
}

function parseCsvEnv(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function greenhouseBoardsFromEnv(): string[] {
  const extra = parseCsvEnv(process.env.GREENHOUSE_BOARDS);
  return extra.length ? extra : DEFAULT_GREENHOUSE_BOARDS;
}

export function ashbyOrgsFromEnv(): string[] {
  const extra = parseCsvEnv(process.env.ASHBY_ORGS);
  return extra.length ? extra : DEFAULT_ASHBY_ORGS;
}

export function leverSitesFromEnv(): string[] {
  return parseCsvEnv(process.env.LEVER_SITES);
}

function urlDedupeKey(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.toLowerCase()}${u.pathname}`.replace(/\/$/, "");
  } catch {
    return url;
  }
}

export function mergeAndDedupeJobs(jobs: JobRow[]): JobRow[] {
  const byUrl = new Map<string, JobRow>();
  const noUrl: JobRow[] = [];

  for (const j of jobs) {
    const key = urlDedupeKey(j.url);
    if (!key || key === "") {
      noUrl.push(j);
      continue;
    }
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, j);
      continue;
    }
    const prefer = sourceRank(j.source) < sourceRank(existing.source) ? j : existing;
    byUrl.set(key, prefer);
  }

  return [...byUrl.values(), ...noUrl];
}

/** Lower = higher priority (direct career site > aggregator) */
function sourceRank(source: string): number {
  if (source.startsWith("Greenhouse")) return 0;
  if (source.startsWith("Ashby")) return 0;
  if (source.startsWith("Lever")) return 0;
  if (source === "Remotive") return 1;
  if (source === "Jobicy") return 2;
  if (source === "Arbeitnow") return 3;
  if (source === "Adzuna") return 4;
  return 5;
}

export function sortJobsByDate(jobs: JobRow[]): void {
  jobs.sort((a, b) => {
    const da = typeof a.published === "string" ? a.published : String(a.published ?? "");
    const db = typeof b.published === "string" ? b.published : String(b.published ?? "");
    return db.localeCompare(da);
  });
}

/** Geçerli tarih yoksa null (filtrelerde elenir). */
export function parsePublishedMs(published: string): number | null {
  const s = published.trim();
  if (!s) return null;
  const ms = Date.parse(s);
  if (Number.isNaN(ms)) return null;
  return ms;
}

/** `hours <= 0` → süre filtresi yok (aynı listeyi döndürür). */
export function filterJobsByMaxAgeHours(jobs: JobRow[], hours: number): JobRow[] {
  if (hours <= 0) return jobs;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return jobs.filter((j) => {
    const ms = parsePublishedMs(j.published);
    if (ms === null) return false;
    return ms >= cutoff;
  });
}
