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
  "frontend engineer",
];

const REVALIDATE = 300;
const REQUEST_RETRIES = 2;
const RETRY_DELAYS_MS = [250, 800];

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

const FRONTEND_TITLE =
  /\b(frontend|front[-\s]?end|ui engineer|web ui|react|next\.?\s*js|javascript frontend|typescript frontend)\b/i;
const FRONTEND_STACK_HINT =
  /\b(react|next\.?\s*js|typescript|javascript|tailwind|css|html|web)\b/i;
const EXCLUDED_TITLE =
  /\b(back[\s-]?end|backend|data engineer|data scientist|machine learning|ml engineer|devops|sre|platform engineer|security engineer|mobile engineer|ios|android|qa engineer|test engineer|site reliability|infra(structure)?|full[\s-]?stack)\b/i;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry<T>(url: string, init: RequestInit): Promise<T | null> {
  for (let attempt = 0; attempt <= REQUEST_RETRIES; attempt += 1) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        if (res.status >= 500 && attempt < REQUEST_RETRIES) {
          await sleep(RETRY_DELAYS_MS[attempt] ?? 1000);
          continue;
        }
        return null;
      }
      return (await res.json()) as T;
    } catch {
      if (attempt >= REQUEST_RETRIES) {
        return null;
      }
      await sleep(RETRY_DELAYS_MS[attempt] ?? 1000);
    }
  }
  return null;
}

export function matchesDevInterest(title: string): boolean {
  const normalized = title.trim();
  if (!normalized) return false;
  if (EXCLUDED_TITLE.test(normalized)) return false;
  return FRONTEND_TITLE.test(normalized) || FRONTEND_STACK_HINT.test(normalized);
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
      url.searchParams.set("results_per_page", "10");
      const data = await fetchJsonWithRetry<{ results?: unknown[] }>(url.toString(), smallFetchInit());
      if (!data) return [];
      const results = data.results ?? [];
      return results
        .map((r) => normalizeAdzuna(r as Parameters<typeof normalizeAdzuna>[0]))
        .filter((job) => matchesDevInterest(job.title));
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
      const data = await fetchJsonWithRetry<{ jobs?: RemotiveJob[] }>(url, smallFetchInit());
      if (!data) return;
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
  const data = await fetchJsonWithRetry<{
    data?: Array<Parameters<typeof normalizeArbeitnow>[0]>;
  }>("https://www.arbeitnow.com/api/job-board-api", smallFetchInit());
  if (!data) return [];
  const rows = (data.data ?? [])
    .filter((j) => matchesDevInterest(j.title))
    .map(normalizeArbeitnow);
  return rows;
}

export async function fetchJobicyFiltered(): Promise<JobRow[]> {
  const url = "https://jobicy.com/api/v2/remote-jobs?count=20";
  const data = await fetchJsonWithRetry<{
    jobs?: Array<Parameters<typeof normalizeJobicy>[0]>;
  }>(url, smallFetchInit());
  if (!data) return [];
  return (data.jobs ?? [])
    .filter((j) => matchesDevInterest(j.jobTitle))
    .map(normalizeJobicy);
}

export async function fetchGreenhouseBoards(boards: string[]): Promise<JobRow[]> {
  const lists = await Promise.all(
    boards.map(async (board) => {
      const data = await fetchJsonWithRetry<{
        jobs?: Array<Parameters<typeof normalizeGreenhouse>[1]>;
      }>(
        `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(board)}/jobs`,
        smallFetchInit(),
      );
      if (!data) return [] as JobRow[];
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
      const data = await fetchJsonWithRetry<AshbyBoardResponse>(
        `https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(org)}`,
        uncachedFetchInit(),
      );
      if (!data) return [] as JobRow[];
      return (data.jobs ?? [])
        .filter((j) => j.isListed !== false)
        .filter((j) => matchesDevInterest(j.title))
        .map((j) => normalizeAshby(org, j));
    }),
  );
  return lists.flat();
}

async function fetchLeverSite(site: string): Promise<JobRow[]> {
  const data = await fetchJsonWithRetry<unknown>(
    `https://api.lever.co/v0/postings/${encodeURIComponent(site)}?limit=100`,
    smallFetchInit(),
  );
  if (!data) return [];
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
