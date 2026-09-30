import crypto from "node:crypto";
import { handleIncomingMessage } from "./_link.js";
import { sendText } from "./_send.js";

// Telegram sends the secret_token given to setWebhook back in this header on
// every update. Anything without it didn't come from Telegram.
function isValidSecret(headerValue) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || typeof headerValue !== "string") return false;
  const expected = Buffer.from(secret);
  const provided = Buffer.from(headerValue);
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(expected, provided);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  if (!isValidSecret(req.headers["x-telegram-bot-api-secret-token"])) {
    res.status(401).send("Unauthorized");
    return;
  }

  const message = req.body?.message;
  // Private chats only — a bot added to a group would otherwise treat every
  // group member's message as a linking attempt.
  if (message?.chat?.type === "private" && typeof message.text === "string" && message.from) {
    const chatId = message.chat.id;
    try {
      await handleIncomingMessage({
        telegramUserId: message.from.id,
        text: message.text,
        reply: (text) => sendText(chatId, text),
      });
    } catch (err) {
      console.error("Telegram flow error:", err);
    }
  }

  // Ack once processing is done, not before — Telegram redelivers an update
  // until it gets a 2xx, which would re-trigger the same message handling.
  res.status(200).send("OK");
}
