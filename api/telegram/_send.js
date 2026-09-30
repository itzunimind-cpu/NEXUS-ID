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
export async function sendText(chatId, text, { buttons } = {}) {
  const payload = { chat_id: chatId, text };
  if (buttons?.length) {
    payload.reply_markup = {
      inline_keyboard: buttons.map((row) =>
        row.map((b) => (b.url ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))
      ),
    };
  }
  return callBotApi("sendMessage", payload);
}

// Stops the loading spinner on a tapped button. Telegram shows it until this
// is called or it times out.
export async function answerCallback(callbackQueryId) {
  return callBotApi("answerCallbackQuery", { callback_query_id: callbackQueryId });
}
