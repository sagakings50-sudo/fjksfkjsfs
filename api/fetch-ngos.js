module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing GEMINI_API_KEY' });

    // 1. Force Gemini to drop the search citations that break JSON formatting
    const safePrompt = req.body.prompt + "\n\nCRITICAL INSTRUCTION: You MUST NOT include any search citations, footnotes, or reference numbers (like [1]) anywhere in your response. Return ONLY pure, raw JSON without any markdown formatting.";

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

    // 2. Safety check in case the AI blocks the prompt
    if (!data.candidates || !data.candidates[0].content) {
       console.error("Gemini empty response:", JSON.stringify(data));
       throw new Error("Gemini returned an empty response.");
    }

    const textResponse = data.candidates[0].content.parts[0].text;
    
    // 3. Log the RAW response to Vercel so we can see exactly what the AI said
    console.log("RAW AI RESPONSE:\n", textResponse); 
    
    const jsonMatch = textResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI did not return a valid JSON structure.");
    }

    // 4. Strict Parsing with Error Logging
    let finalData;
    try {
      finalData = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      console.error("JSON PARSE FAILED. The AI generated corrupted data:\n", jsonMatch[0]);
      throw new Error("AI generated corrupted JSON formatting.");
    }

    res.status(200).json(finalData);

  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: error.message });
  }
}
