async function callBotApi(method, payload) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram ${method} failed (${res.status}): ${body}`);
  }
  return res.json();
}

// buttons: rows of { text, data } (tap sends `data` back as a callback) or
// { text, url } (tap opens a link). Kept to one shape so flows never build
// Telegram's inline_keyboard format by hand.
function replyMarkup(buttons) {
  return {
    inline_keyboard: (buttons || []).map((row) =>
      row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))
    ),
  };
}

export async function sendText(chatId, text, { buttons } = {}) {
  const payload = { chat_id: chatId, text };
  if (buttons?.length) payload.reply_markup = replyMarkup(buttons);
  return callBotApi("sendMessage", payload);
}

// Replaces an existing bot message's text and buttons in place — used so a
// button tap turns the tapped message into the next screen instead of
// stacking a new message under it. Always sends a keyboard (empty if no
// buttons) so the old buttons disappear.
export async function editText(chatId, messageId, text, { buttons } = {}) {
  try {
    return await callBotApi("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text,
      reply_markup: replyMarkup(buttons),
    });
  } catch (err) {
    // Same text and buttons as before — nothing to change, not a failure.
    if (String(err.message).includes("message is not modified")) return null;
    throw err;
  }
}

// Stops the loading spinner on a tapped button. Telegram shows it until this
// is called or it times out.
export async function answerCallback(callbackQueryId) {
  return callBotApi("answerCallbackQuery", { callback_query_id: callbackQueryId });
}
