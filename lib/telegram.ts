import type { JobRow } from "@/lib/jobs";

type InlineKeyboardButton = {
  text: string;
  callback_data?: string;
  url?: string;
};

type TelegramReplyMarkup = {
  inline_keyboard: InlineKeyboardButton[][];
};

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

function getTelegramBaseUrl(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("TELEGRAM_BOT_TOKEN missing");
  }
  return `https://api.telegram.org/bot${token}`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

async function telegramRequest<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${getTelegramBaseUrl()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const json = (await res.json()) as TelegramApiResponse<T>;
  if (!res.ok || !json.ok || json.result === undefined) {
    throw new Error(json.description || `Telegram ${method} failed with ${res.status}`);
  }
  return json.result;
}

function jobReplyMarkup(job: JobRow): TelegramReplyMarkup {
  return {
    inline_keyboard: [
      [
        { text: "Details", callback_data: `detail:${job.id}` },
        { text: "Dismiss", callback_data: `dismiss:${job.id}` },
      ],
      [{ text: "Apply", url: job.url }],
    ],
  };
}

export function formatJobMessage(job: JobRow): string {
  const published = job.published ? job.published.slice(0, 19).replace("T", " ") : "Unknown";
  return [
    "<b>New job found</b>",
    "",
    `<b>${escapeHtml(job.title)}</b>`,
    `${escapeHtml(job.company)} • ${escapeHtml(job.location)}`,
    `Source: ${escapeHtml(job.source)}`,
    `Type: ${escapeHtml(job.jobType || "—")}`,
    `Category: ${escapeHtml(job.category || "—")}`,
    `Date: ${escapeHtml(published)}`,
  ].join("\n");
}

export function formatJobDetail(job: JobRow): string {
  return [
    `<b>${escapeHtml(job.title)}</b>`,
    "",
    `Company: ${escapeHtml(job.company)}`,
    `Location: ${escapeHtml(job.location)}`,
    `Source: ${escapeHtml(job.source)}`,
    `Type: ${escapeHtml(job.jobType || "—")}`,
    `Category: ${escapeHtml(job.category || "—")}`,
    `Published: ${escapeHtml(job.published || "Unknown")}`,
    "",
    "Note: Most list APIs do not return the full job description.",
    "The Apply button takes you directly to the original job post.",
  ].join("\n");
}

export async function sendJobNotification(chatId: string, job: JobRow): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text: formatJobMessage(job),
    parse_mode: "HTML",
    reply_markup: jobReplyMarkup(job),
    disable_web_page_preview: true,
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text: string): Promise<void> {
  await telegramRequest("answerCallbackQuery", {
    callback_query_id: callbackQueryId,
    text,
    show_alert: false,
  });
}

export async function sendTextMessage(chatId: string, text: string): Promise<void> {
  await telegramRequest("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
  });
}

export async function setTelegramWebhook(url: string): Promise<{ url: string }> {
  return telegramRequest("setWebhook", {
    url,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
}
