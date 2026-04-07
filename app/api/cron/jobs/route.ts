import { NextResponse, type NextRequest } from "next/server";
import { fetchJobsFeed } from "@/lib/job-feed";
import { getPendingJobs, markJobSent, upsertFetchedJobs } from "@/lib/job-store";
import { sendJobNotification } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) return true;

  const bearer = request.headers.get("authorization");
  const headerSecret = bearer?.replace(/^Bearer\s+/i, "").trim();
  const querySecret = request.nextUrl.searchParams.get("secret");
  return headerSecret === configuredSecret || querySecret === configuredSecret;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!chatId) {
    return NextResponse.json({ error: "TELEGRAM_CHAT_ID missing" }, { status: 500 });
  }

  const result = await fetchJobsFeed({ sinceHours: 24, limit: 25 });
  const freshJobs = await upsertFetchedJobs(result.jobs);
  const pendingJobs = await getPendingJobs(freshJobs.map((job) => job.id));

  let sent = 0;
  for (const job of pendingJobs) {
    await sendJobNotification(chatId, job);
    await markJobSent(job.id);
    sent += 1;
  }

  return NextResponse.json({
    ok: true,
    fetchedAt: result.fetchedAt,
    fetched: result.jobs.length,
    newJobs: freshJobs.length,
    sent,
  });
}
