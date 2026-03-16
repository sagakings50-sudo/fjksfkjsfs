module.exports = async function handler(req, res) {
  // We are temporarily skipping Gemini to test the Vercel connection
  const dummyData = {
    "todayEvents": [{
      "org": "SYSTEM TEST",
      "orgColor": "blue",
      "title": "Connection Successful!",
      "desc": "If you see this on your screen, Vercel and your frontend are working perfectly.",
      "badge": "Test Passed",
      "badgeColor": "blue",
      "date": "Right Now",
      "location": "Vercel Server"
    }],
    "upcomingEvents": [],
    "alerts": [],
    "ramadan": {"show": false},
    "stats": {"todayCount": 1, "upcomingCount": 0, "alertsCount": 0}
  };

  return res.status(200).json(dummyData);
}
