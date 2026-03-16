module.exports = async function handler(req, res) {
  // 1. Using GET allows Vercel to cache the response for you
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const today = new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });

    // 2. Strict Lahore-only prompt with a BAN on academic spam
    const safePrompt = `You are a strict NGO tracker for Lahore, Pakistan. Today is ${today}.
    
    CRITICAL BANS:
    - NO Academic Conferences (e.g., "Academic World Research", "ICCDSW", "ICA2SR").
    - NO University summits or research papers.
    - NO data from outside Lahore city.

    STRICT RULES:
    - ONLY include verified NGOs/INGOs in Lahore (e.g., Edhi, Alkhidmat, Akhuwat, Rizq, SOS Village).
    - Look for: Medical camps, ration drives, welfare news, and incident reports.
    - Descriptions must be MAX 2 LINES.
    - SOURCE LINKS: Provide the actual URL for every single item.
    - NO CITATIONS: Do not include [1] or [2] in the JSON.

    Return ONLY valid JSON:
    {
      "todayEvents": [ { "org": "", "orgColor": "green", "title": "", "desc": "", "members": [""], "badge": "Active", "badgeColor": "green", "date": "${today}", "location": "Lahore", "sourceUrl": "", "sourceLabel": "" } ],
      "upcomingEvents": [],
      "alerts": [],
      "ramadan": { "show": true, "day": "", "message": "" },
      "stats": { "todayCount": 0, "upcomingCount": 0, "alertsCount": 0 }
    }`;

    // 3. Using the high-capacity Lite model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: safePrompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.2 }
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');

    const textResponse = data.candidates[0].content.parts[0].text;
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI formatting.");

    // 4. THE MAGIC: Cache this successful response for 1 hour (3600 seconds)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
