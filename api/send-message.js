import axios from "axios";

export default async function handler(req, res) {
  // ✅ Voeg CORS headers toe
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  // ✅ OPTIONS-verzoeken direct beantwoorden voor CORS
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  try {
    if (req.method !== "GET") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const { recipient, message } = req.query;
    const API_KEY = process.env.TEXTMEBOT_API_KEY;

    if (!recipient || !message) {
      console.error("Fout: ontbrekende parameters", { recipient, message });
      return res.status(400).json({ error: "Recipient and message required" });
    }

    const apiUrl = `https://api.textmebot.com/send.php?recipient=${recipient}&apikey=${API_KEY}&text=${encodeURIComponent(
      message
    )}`;

    console.log(`Versturen naar: ${apiUrl}`); // Log de URL

    const response = await axios.get(apiUrl);

    return res.status(200).json({ success: true, data: response.data });
  } catch (error) {
    console.error("Server error:", error.message);
    return res.status(500).json({
      error: "Fout bij doorsturen van bericht",
      details: error.message,
    });
  }
}
