import crypto from "node:crypto";
import { handleUpdate } from "./_router.js";
import { sendText, editText, answerCallback } from "./_send.js";

// Flows often reply in several parts ("✅ Approved." then the next screen).
// Collect them and send one message: texts joined, buttons stacked in order.
function collector() {
  const parts = [];
  return {
    add: async (text, opts) => {
      parts.push({ text, buttons: opts?.buttons || [] });
    },
    combine: () => {
      if (!parts.length) return null;
      const seen = new Set();
      const buttons = parts.flatMap((p) => p.buttons).filter((row) => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return { text: parts.map((p) => p.text).join("\n\n"), buttons };
    },
  };
}

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

  const { message, callback_query: callback } = req.body || {};

  try {
    // Private chats only — a bot added to a group would otherwise treat every
    // group member's message as input to their own flow.
    if (message?.chat?.type === "private" && typeof message.text === "string" && message.from) {
      const chatId = message.chat.id;
      const replies = collector();
      await handleUpdate({ telegramUserId: message.from.id, text: message.text, reply: replies.add });
      const combined = replies.combine();
      if (combined) await sendText(chatId, combined.text, combined);
    } else if (callback?.message?.chat?.type === "private" && callback.from) {
      const chatId = callback.message.chat.id;
      await answerCallback(callback.id);
      const replies = collector();
      await handleUpdate({ telegramUserId: callback.from.id, data: callback.data, reply: replies.add });
      const combined = replies.combine();
      if (combined) {
        // Turn the tapped message into the next screen, so menus change in
        // place instead of stacking. Fall back to a new message if Telegram
        // won't edit it.
        await editText(chatId, callback.message.message_id, combined.text, combined).catch(() =>
          sendText(chatId, combined.text, combined)
        );
      }
    }
  } catch (err) {
    console.error("Telegram flow error:", err);
  }

  // Ack once processing is done, not before — Telegram redelivers an update
  // until it gets a 2xx, which would re-trigger the same message handling.
  res.status(200).send("OK");
}
