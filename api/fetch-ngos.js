module.exports = async function handler(req, res) {
  // We use GET so Vercel can cache the response for you
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const today = new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });

    // The strict Lahore-only prompt
    const safePrompt = `Strictly track real NGO events in Lahore, Pakistan. Today is ${today}. 
    RULES: No academic conferences. No events outside Lahore. Max 2 line descriptions.
    Return ONLY raw valid JSON:
    {
      "todayEvents": [ { "org": "", "orgColor": "", "title": "", "desc": "", "members": [""], "badge": "", "badgeColor": "", "date": "", "location": "", "sourceUrl": "", "sourceLabel": "" } ],
      "upcomingEvents": [],
      "alerts": [],
      "ramadan": { "show": true, "day": "", "message": "" },
      "stats": { "todayCount": 0, "upcomingCount": 0, "alertsCount": 0 }
    }`;

    // Switching to the high-quota Lite model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: safePrompt }] }],
        tools: [{ googleSearch: {} }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gemini API Error');

    const textResponse = data.candidates[0].content.parts[0].text;
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("Invalid AI formatting.");

    // EDGE CACHING: Memorize this data for 1 hour (3600 seconds)
    // This stops you from hitting the quota even if you refresh 100 times.
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
