"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { JobRow } from "@/lib/jobs";

type ApiResponse = {
  jobs: JobRow[];
  sources: string[];
  fetchedAt: string;
  meta?: Record<string, number>;
};

const US_HINTS = /\b(US|USA|United States|America|U\.S\.|anywhere|worldwide|remote)\b/i;

function matchesUsPreference(job: JobRow): boolean {
  const loc = job.location;
  if (!loc || loc === "—") return true;
  if (US_HINTS.test(loc)) return true;
  if (/michigan|illinois|georgia|chicago|detroit|atlanta/i.test(loc)) return true;
  return false;
}

export default function Home() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [usOnly, setUsOnly] = useState(false);
  const [hideSenior, setHideSenior] = useState(true);
  /** Varsayılan: son 24 saat + sunucuda sınırlı kayıt — daha az veri */
  const [lastDayOnly, setLastDayOnly] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (lastDayOnly) {
        params.set("sinceHours", "24");
        params.set("limit", "100");
      } else {
        params.set("sinceHours", "0");
        params.set("limit", "150");
      }
      const res = await fetch(`/api/jobs?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ApiResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [lastDayOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (!data?.jobs) return [];
    const q = query.trim().toLowerCase();
    return data.jobs.filter((job) => {
      if (usOnly && !matchesUsPreference(job)) return false;
      if (hideSenior && /\bsenior\b/i.test(job.title)) return false;
      if (!q) return true;
      const hay =
        `${job.title} ${job.company} ${job.location} ${job.category} ${job.source}`.toLowerCase();
      return hay.includes(q);
    });
  }, [data, query, usOnly, hideSenior]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 border-b border-[var(--border)] pb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--text)]">
          Frontend / React ilanları
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
          Kaynaklar:{" "}
          <span className="text-[var(--text)]">
            {data?.sources?.length
              ? data.sources.join(", ")
              : "Adzuna, Remotive, Arbeitnow, Jobicy, Greenhouse, Ashby (+ isteğe bağlı Lever)"}
          </span>
          . ATS panoları (Greenhouse / Ashby) ve iş panoları ücretsiz uçlar;{" "}
          <a
            href="https://jobicy.com"
            className="text-[var(--accent)] underline-offset-2 hover:underline"
            target="_blank"
            rel="noreferrer"
          >
            Jobicy
          </a>{" "}
          kaynak gösterimi istiyor. Proje:{" "}
          <code className="rounded bg-[var(--surface)] px-1.5 py-0.5 text-xs">
            clones/us-jobs
          </code>
          .
        </p>
        {data?.fetchedAt && (
          <p className="mt-1 text-xs text-[var(--muted)]">
            Son çekim: {new Date(data.fetchedAt).toLocaleString("tr-TR")}
            {data.meta && (
              <span className="ml-2 opacity-80">
                (ham birleşik {data.meta.merged ?? "—"}
                {typeof data.meta.afterTimeFilter === "number"
                  ? ` → süzülmüş ${data.meta.afterTimeFilter}`
                  : ""}
                ; API dönen {data.meta.returned ?? data.jobs.length}/{data.meta.limit ?? "—"}, son{" "}
                {data.meta.sinceHours === 0 ? "tümü" : `${data.meta.sinceHours} saat`})
              </span>
            )}
          </p>
        )}
      </header>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block flex-1 min-w-[200px]">
          <span className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
            Ara (başlık, şirket, lokasyon)
          </span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="react, typescript, next…"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={usOnly}
              onChange={(e) => setUsOnly(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            US / worldwide friendly lokasyon
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={hideSenior}
              onChange={(e) => setHideSenior(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            “Senior” başlıkları gizle
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[var(--text)]">
            <input
              type="checkbox"
              checked={lastDayOnly}
              onChange={(e) => setLastDayOnly(e.target.checked)}
              className="rounded border-[var(--border)]"
            />
            Son 24 saatte yayınlananlar (sunucu filtresi)
          </label>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          {loading ? "Yükleniyor…" : "Yenile"}
        </button>
      </div>

      {error && (
        <p className="mb-4 rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <p className="mb-3 text-sm text-[var(--muted)]">
        {loading
          ? "…"
          : `${filtered.length} ilan (ek filtrelere göre; API’den gelen ${data?.jobs.length ?? 0})`}
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-3 py-3 font-medium">Başlık</th>
              <th className="px-3 py-3 font-medium">Şirket</th>
              <th className="px-3 py-3 font-medium">Kaynak</th>
              <th className="px-3 py-3 font-medium">Lokasyon</th>
              <th className="px-3 py-3 font-medium">Tür</th>
              <th className="px-3 py-3 font-medium">Tarih</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((job) => (
              <tr
                key={job.id}
                className="border-b border-[var(--border)]/60 last:border-0 hover:bg-[#1c1c26]"
              >
                <td className="px-3 py-3">
                  <a
                    href={job.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-[var(--accent)] hover:underline"
                  >
                    {job.title}
                  </a>
                </td>
                <td className="px-3 py-3 text-[var(--text)]">{job.company}</td>
                <td
                  className="max-w-[140px] truncate px-3 py-3 text-xs text-[var(--muted)]"
                  title={job.source}
                >
                  {job.source}
                </td>
                <td className="max-w-[220px] truncate px-3 py-3 text-[var(--muted)]" title={job.location}>
                  {job.location}
                </td>
                <td className="px-3 py-3 text-[var(--muted)]">{job.jobType}</td>
                <td className="whitespace-nowrap px-3 py-3 text-[var(--muted)]">
                  {job.published ? job.published.slice(0, 10) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <p className="px-3 py-8 text-center text-[var(--muted)]">Sonuç yok — filtreyi gevşet veya yenile.</p>
        )}
      </div>
    </main>
  );
}
