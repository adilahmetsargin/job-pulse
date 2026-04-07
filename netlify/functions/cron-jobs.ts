function resolveSiteUrl(): string {
  const raw =
    process.env.URL ||
    process.env.DEPLOY_PRIME_URL ||
    process.env.NETLIFY_SITE_URL ||
    process.env.netlify ||
    process.env.APP_BASE_URL;

  if (!raw) {
    throw new Error("Netlify site URL env missing");
  }

  return raw.replace(/\/$/, "");
}

export default async () => {
  const siteUrl = resolveSiteUrl();
  const secret = process.env.CRON_SECRET?.trim();

  const res = await fetch(`${siteUrl}/api/cron/jobs`, {
    method: "GET",
    headers: secret ? { Authorization: `Bearer ${secret}` } : {},
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Cron trigger failed: ${res.status} ${body}`);
  }

  const body = await res.text();
  console.log(`[cron-jobs] ${body}`);
};
