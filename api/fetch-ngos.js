module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const today = new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });

    // We force Gemini to NOT use citations [1] which break the code structure
    const safePrompt = `You are a strict NGO tracker for Lahore, Pakistan. Today is ${today}. Search for verified NGO events (medical camps, ration drives, welfare news) in Lahore only. 

    CRITICAL: 
    - DO NOT include citations like [1] or [2].
    - NO academic conferences or research papers.
    - Return ONLY raw, valid JSON.

    Schema:
    {
      "todayEvents": [ { "org": "", "orgColor": "", "title": "", "desc": "", "members": [""], "badge": "", "badgeColor": "", "date": "", "location": "", "sourceUrl": "", "sourceLabel": "" } ],
      "upcomingEvents": [],
      "alerts": [],
      "ramadan": { "show": true, "day": "", "message": "" },
      "stats": { "todayCount": 0, "upcomingCount": 0, "alertsCount": 0 }
    }`;

    // Using the high-quota stable model
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/); // Extract only the JSON object
    
    if (!jsonMatch) throw new Error("AI did not return valid JSON.");

    // CACHING: Memorize this for 1 hour so you don't hit the quota again
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).json(JSON.parse(jsonMatch[0]));

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
