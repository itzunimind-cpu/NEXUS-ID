import crypto from "node:crypto";
import { handleIncomingMessage } from "./flows/link.js";

// Raw body access is required to verify Meta's HMAC signature — a
// parsed-then-restringified body isn't guaranteed to match the original
// bytes. Disables Vercel's default JSON body parsing for this function.
export const config = {
  api: { bodyParser: false },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function isValidSignature(rawBody, signatureHeader) {
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret || !signatureHeader) return false;
  const expected = crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const provided = signatureHeader.replace(/^sha256=/, "");
  if (expected.length !== provided.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

export default async function handler(req, res) {
  // Meta's one-time webhook verification handshake, done once when the
  // webhook URL is registered in the Meta developer dashboard.
  if (req.method === "GET") {
    const { "hub.mode": mode, "hub.verify_token": token, "hub.challenge": challenge } = req.query;
    if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      res.status(200).send(challenge);
      return;
    }
    res.status(403).send("Forbidden");
    return;
  }

  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  const rawBody = await readRawBody(req);

  if (!isValidSignature(rawBody, req.headers["x-hub-signature-256"])) {
    res.status(401).send("Invalid signature");
    return;
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    res.status(400).send("Bad Request");
    return;
  }

  const message = payload?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message?.type === "text") {
    // Meta sends the sender's number without a leading '+'; every write
    // path in this project stores/compares phone numbers in full E.164.
    const from = `+${message.from}`;
    const text = message.text?.body ?? "";
    try {
      await handleIncomingMessage({ from, text });
    } catch (err) {
      console.error("WhatsApp flow error:", err);
    }
  }

  // Ack once processing is done, not before — Meta retries aggressively on
  // non-200s, which would otherwise re-trigger the same message handling.
  res.status(200).send("OK");
}
