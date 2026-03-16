module.exports = async function handler(req, res) {
  // We use GET so Vercel can cache the response
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const today = new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });

    const safePrompt = `You are a strict NGO tracker for Lahore, Pakistan. Today is ${today}. 
    Search for verified NGO/INGO events (medical camps, ration drives, welfare news) in Lahore only. 
    BANNED: No academic conferences, research papers, or corporate summits.
    RULES: Max 2 line descriptions. Provide source URLs for every item. Do NOT include citations like [1].
    
    Return ONLY raw valid JSON:
    {
      "todayEvents": [ { "org": "", "orgColor": "green", "title": "", "desc": "", "members": [""], "badge": "Active", "badgeColor": "green", "date": "${today}", "location": "Lahore", "sourceUrl": "", "sourceLabel": "" } ],
      "upcomingEvents": [],
      "alerts": [],
      "ramadan": { "show": true, "day": "", "message": "" },
      "stats": { "todayCount": 0, "upcomingCount": 0, "alertsCount": 0 }
    }`;

    // Updated to the stable 2.0-flash model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
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

    // EDGE CACHING: Memorize this for 1 hour to protect your quota
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
