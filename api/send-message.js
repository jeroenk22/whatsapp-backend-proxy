import axios from "axios";

const ALLOWED_ORIGINS = ["https://jeroenk22.github.io"];
const MAX_MESSAGE_LENGTH = 2000;

// Zelfde logica als clientside formatMobileNumber
function normalizePhoneNumber(number) {
  if (!number) return "";

  // Spaties en niet-numerieke tekens verwijderen
  const cleanedNumber = number.replace(/\D+/g, "");

  // 06xxxxxxxx -> +31xxxxxxxxx
  if (cleanedNumber.startsWith("06")) {
    return `+31${cleanedNumber.slice(1)}`;
  }

  // 316xxxxxxxx -> +316xxxxxxxx
  if (cleanedNumber.startsWith("316")) {
    return `+${cleanedNumber}`;
  }

  // 00316xxxxxxxx -> +316xxxxxxxx
  if (cleanedNumber.startsWith("00316")) {
    return `+31${cleanedNumber.slice(4)}`;
  }

  // Ongeldig nummer → lege string
  return "";
}

export default async function handler(req, res) {
  const origin = req.headers.origin;

  // ✅ CORS alleen toelaten vanaf jouw frontend origin
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ OPTIONS-verzoeken direct beantwoorden voor CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { recipient, message, token: rawToken } = req.query;
    const token = (rawToken || "").trim();

    const API_KEY = process.env.TEXTMEBOT_API_KEY;
    const INTERNAL_TOKEN = (process.env.INTERNAL_API_TOKEN || "").trim();

    // ✅ Token check
    if (!INTERNAL_TOKEN || !token || token !== INTERNAL_TOKEN) {
      console.warn("Unauthorized request (invalid token)", {
        origin,
        hasToken: !!token,
        hasEnvToken: !!INTERNAL_TOKEN,
        tokenLength: token.length,
        envTokenLength: INTERNAL_TOKEN.length,
      });
      return res.status(401).json({ error: "Unauthorized" });
    }

    // ✅ Nummer normaliseren + valideren
    const phone = normalizePhoneNumber(recipient);

    if (!phone) {
      console.error("Invalid phone number:", recipient);
      return res.status(400).json({ error: "Invalid phone number" });
    }

    // ✅ Message valideren
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ error: "Message is required" });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        error: `Message too long (max ${MAX_MESSAGE_LENGTH} characters)`,
      });
    }

    if (!API_KEY) {
      console.error("TEXTMEBOT_API_KEY ontbreekt in environment");
      return res.status(500).json({ error: "Server misconfigured" });
    }

    const apiUrl =
      `https://api.textmebot.com/send.php?` +
      `recipient=${encodeURIComponent(phone)}` +
      `&apikey=${encodeURIComponent(API_KEY)}` +
      `&text=${encodeURIComponent(message)}`;

    // ✅ Timeout toevoegen zodat we vóór Vercel’s 10s-limit klaar zijn
    const response = await axios.get(apiUrl, {
      timeout: 8000, // 8 seconden
    });

    return res.status(200).json({
      success: true,
      recipient: phone,
      data: response.data,
    });
  } catch (error) {
    // Specifieke afhandeling als TextMeBot te langzaam is
    if (error.code === "ECONNABORTED") {
      console.error("Upstream timeout: TextMeBot did not respond in time");
      return res.status(504).json({
        error: "Upstream timeout",
        details: "TextMeBot did not respond in time",
      });
    }

    console.error("Server error:", error.message);
    return res.status(500).json({
      error: "Fout bij doorsturen van bericht",
      details: error.message,
    });
  }
}
