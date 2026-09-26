const GRAPH_VERSION = "v20.0";

async function callGraphApi(payload) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${body}`);
  }
  return res.json();
}

// Plain text reply — the only message type Phase 0 needs. Interactive
// button/list messages get added here once a later phase's menu needs them.
export async function sendText(to, body) {
  return callGraphApi({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body },
  });
}
