import { NextResponse, type NextRequest } from "next/server";
import { fetchJobsFeed } from "@/lib/job-feed";

/** Build sırasında dış API çağrısı ve 2MB+ önbellek sorunlarını önler */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const sinceHours = sp.get("sinceHours") === null ? 24 : Number(sp.get("sinceHours")) || 0;
  const limit = Number(sp.get("limit")) || 100;
  const result = await fetchJobsFeed({ sinceHours, limit });
  return NextResponse.json(result);
}
