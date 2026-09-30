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

// Plain text reply — the only message type Phase 0 needs. Inline-keyboard
// (button) helpers get added here once a later phase's menu needs them.
export async function sendText(chatId, text) {
  return callBotApi("sendMessage", { chat_id: chatId, text });
}
