import type { JobRow } from "@/lib/jobs";

type StoredJob = JobRow & {
  first_seen_at: string;
  last_sent_at: string | null;
  dismissed_at: string | null;
};

type JobRecord = {
  job_id: string;
  source: string;
  title: string;
  company: string;
  url: string;
  location: string;
  category: string;
  published: string;
  job_type: string;
  payload: JobRow;
  first_seen_at: string;
  last_sent_at: string | null;
  dismissed_at: string | null;
};

const TABLE = "job_notifications";

function getSupabaseUrl(): string {
  const value = process.env.SUPABASE_URL?.trim();
  if (!value) throw new Error("SUPABASE_URL missing");
  return value.replace(/\/$/, "");
}

function getSupabaseKey(): string {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const anon = process.env.SUPABASE_ANON_KEY?.trim();
  const value = serviceRole || anon;
  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY missing");
  }
  return value;
}

function encodeIn(values: string[]): string {
  return values.map((value) => `"${value.replaceAll('"', '\\"')}"`).join(",");
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit = {},
  allow404 = false,
): Promise<T> {
  const res = await fetch(`${getSupabaseUrl()}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: getSupabaseKey(),
      Authorization: `Bearer ${getSupabaseKey()}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  if (allow404 && res.status === 404) {
    return [] as T;
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase request failed: ${res.status} ${text}`);
  }

  if (res.status === 204) {
    return [] as T;
  }

  return (await res.json()) as T;
}

function toStoredJob(record: JobRecord): StoredJob {
  return {
    ...record.payload,
    first_seen_at: record.first_seen_at,
    last_sent_at: record.last_sent_at,
    dismissed_at: record.dismissed_at,
  };
}

function toRowPayload(job: JobRow): Omit<JobRecord, "first_seen_at" | "last_sent_at" | "dismissed_at"> {
  return {
    job_id: job.id,
    source: job.source,
    title: job.title,
    company: job.company,
    url: job.url,
    location: job.location,
    category: job.category,
    published: job.published,
    job_type: job.jobType,
    payload: job,
  };
}

export async function getTrackedJob(id: string): Promise<StoredJob | null> {
  const query = `${TABLE}?job_id=eq.${encodeURIComponent(id)}&select=*`;
  const rows = await supabaseRequest<JobRecord[]>(query, { method: "GET" }, true);
  return rows[0] ? toStoredJob(rows[0]) : null;
}

async function getTrackedJobsByIds(ids: string[]): Promise<Map<string, StoredJob>> {
  if (!ids.length) return new Map();
  const query = `${TABLE}?job_id=in.(${encodeIn(ids)})&select=*`;
  const rows = await supabaseRequest<JobRecord[]>(query, { method: "GET" }, true);
  return new Map(rows.map((row) => [row.job_id, toStoredJob(row)]));
}

export async function upsertFetchedJobs(jobs: JobRow[]): Promise<JobRow[]> {
  if (!jobs.length) return [];

  const existing = await getTrackedJobsByIds(jobs.map((job) => job.id));
  const fresh = jobs.filter((job) => !existing.has(job.id));

  await supabaseRequest<JobRecord[]>(
    `${TABLE}?on_conflict=job_id`,
    {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(jobs.map((job) => toRowPayload(job))),
    },
    true,
  );

  return fresh;
}

export async function markJobSent(id: string): Promise<void> {
  await supabaseRequest<JobRecord[]>(
    `${TABLE}?job_id=eq.${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ last_sent_at: new Date().toISOString() }),
    },
    true,
  );
}

export async function dismissJob(id: string): Promise<boolean> {
  const rows = await supabaseRequest<JobRecord[]>(
    `${TABLE}?job_id=eq.${encodeURIComponent(id)}&dismissed_at=is.null`,
    {
      method: "PATCH",
      body: JSON.stringify({ dismissed_at: new Date().toISOString() }),
    },
    true,
  );
  return rows.length > 0;
}

export async function getPendingJobs(ids: string[]): Promise<StoredJob[]> {
  const rows = await getTrackedJobsByIds(ids);
  return ids
    .map((id) => rows.get(id))
    .filter((job): job is StoredJob => job != null)
    .filter((job) => !job.dismissed_at && !job.last_sent_at);
}
