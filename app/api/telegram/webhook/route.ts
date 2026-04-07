import { NextResponse } from "next/server";
import { dismissJob, getTrackedJob } from "@/lib/job-store";
import {
  answerCallbackQuery,
  formatJobDetail,
  sendTextMessage,
} from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TelegramUpdate = {
  callback_query?: {
    id: string;
    data?: string;
    message?: {
      chat?: {
        id?: number;
      };
    };
  };
};

export async function POST(request: Request) {
  const update = (await request.json()) as TelegramUpdate;
  const callback = update.callback_query;

  if (!callback?.id || !callback.data) {
    return NextResponse.json({ ok: true });
  }

  const [action, ...rest] = callback.data.split(":");
  const jobId = rest.join(":");
  const chatId = callback.message?.chat?.id;

  if (!jobId || !chatId) {
    await answerCallbackQuery(callback.id, "Gecerli ilan bulunamadi.");
    return NextResponse.json({ ok: true });
  }

  if (action === "detail") {
    const job = await getTrackedJob(jobId);
    if (!job) {
      await answerCallbackQuery(callback.id, "Ilan artik mevcut degil.");
      return NextResponse.json({ ok: true });
    }

    await answerCallbackQuery(callback.id, "Ilan ozeti gonderildi.");
    await sendTextMessage(String(chatId), formatJobDetail(job));
    return NextResponse.json({ ok: true });
  }

  if (action === "dismiss") {
    const dismissed = await dismissJob(jobId);
    await answerCallbackQuery(callback.id, dismissed ? "Ilan reddedildi." : "Ilan bulunamadi.");
    return NextResponse.json({ ok: true });
  }

  await answerCallbackQuery(callback.id, "Bilinmeyen islem.");
  return NextResponse.json({ ok: true });
}
