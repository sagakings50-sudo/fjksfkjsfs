module.exports = async function handler(req, res) {
  // 1. Changed to GET so Vercel can cache the response
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    const today = new Date().toLocaleDateString('en-PK', { timeZone: 'Asia/Karachi', day: 'numeric', month: 'long', year: 'numeric' });

    // 2. The strict prompt is now hidden safely on the server
    const safePrompt = `You are a strict, real-time NGO intelligence tracker for Lahore, Pakistan. Today is ${today}.

Search the web and news sites for the LATEST information regarding actual on-the-ground NGOs in Lahore.

CRITICAL BANS (DO NOT INCLUDE THESE):
- NO Academic Conferences (e.g., "Academic World Research", "ICCDSW", "ICA2SR", "ICSESM").
- NO University symposiums, research paper calls, or corporate summits.
- NO events outside of Lahore.

STRICT RULES:
- ONLY include actual events, campaigns, and news from verified NGOs and INGOs physically operating in Lahore (e.g., Edhi, Alkhidmat, Akhuwat, Saylani, Rizq, SOS Village, Shaukat Khanum, HRCP, CARE Foundation, transparent hands, etc.).
- Acceptable event types: Medical camps, ration distributions, volunteer drives, official NGO fundraisers, rescue operations, and human rights interventions.
- Descriptions must be MAX 2 LINES.
- Pull key member names from the posts.
- For events: search specifically for NGO names combined with "Lahore event", "welfare drive", "ration distribution", "free medical camp Lahore".
- UPCOMING SECTION: Must be actual NGO activities scheduled AFTER today in Lahore. 
- SOURCE LINKS: For every single item, include the actual URL of the webpage or social media post.

CRITICAL INSTRUCTION: You MUST NOT include any search citations, footnotes, or reference numbers (like [1]) anywhere in your response. Return ONLY pure, raw JSON without any markdown formatting.

Return ONLY valid JSON exactly matching this structure:
{
  "todayEvents": [ { "org": "", "orgColor": "", "title": "", "desc": "", "members": [""], "badge": "", "badgeColor": "", "date": "", "location": "", "sourceUrl": "", "sourceLabel": "" } ],
  "upcomingEvents": [ { "title": "", "desc": "", "date": "", "orgs": [""], "color": "", "sourceUrl": "", "sourceLabel": "" } ],
  "alerts": [ { "title": "", "desc": "", "date": "", "color": "", "members": [""], "sourceUrl": "", "sourceLabel": "" } ],
  "ramadan": { "show": true, "day": "", "message": "" },
  "stats": { "todayCount": 0, "upcomingCount": 0, "alertsCount": 0 }
}`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
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
    if (!data.candidates || !data.candidates[0].content) throw new Error("Gemini returned an empty response.");

    const textResponse = data.candidates[0].content.parts[0].text;
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI did not return a valid JSON structure.");

    let finalData;
    try {
      finalData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON PARSE FAILED:\n", jsonMatch[0]);
      throw new Error("AI generated corrupted JSON formatting.");
    }

    // 3. THE MAGIC TRICK: Tell Vercel to cache this successful response for 1 hour (3600 seconds)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    
    res.status(200).json(finalData);

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
