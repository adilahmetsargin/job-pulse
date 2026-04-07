import { NextResponse, type NextRequest } from "next/server";
import { setTelegramWebhook } from "@/lib/telegram";

export const runtime = "nodejs";

function resolveBaseUrl(request: NextRequest): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const netlify = process.env.netlify?.trim();
  if (netlify) return netlify.replace(/\/$/, "");
  return request.nextUrl.origin.replace(/\/$/, "");
}

export async function GET(request: NextRequest) {
  try {
    const baseUrl = resolveBaseUrl(request);
    const webhookUrl = `${baseUrl}/api/telegram/webhook`;
    const result = await setTelegramWebhook(webhookUrl);

    return NextResponse.json({
      ok: true,
      webhookUrl,
      telegram: result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown setup error";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
