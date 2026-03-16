module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY in Vercel settings.' });
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: req.body.prompt }] }],
        tools: [{ googleSearch: {} }], // Live search is kept
        generationConfig: {
          temperature: 0.2 // JSON enforcer removed
        }
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gemini API Error');
    }

    let textResponse = data.candidates[0].content.parts[0].text;
    
    // Clean up any markdown formatting (like ```json) the AI might add
    textResponse = textResponse.replace(/```json|```/g, '').trim();
    
    res.status(200).json(JSON.parse(textResponse));

  } catch (error) {
    console.error("API Error:", error);
    res.status(500).json({ error: error.message });
  }
}
