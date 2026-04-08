// /api/generate.js
// Secure server-side Claude API proxy
// API key never reaches the browser

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // CORS — allow your domain only in production
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    'https://auditrecipe.com',
    'https://www.auditrecipe.com',
    'https://auditrecipe.io',
    'https://www.auditrecipe.io',
    // Vercel preview URLs
    /\.vercel\.app$/,
    // Local dev
    'http://localhost:3000',
    'http://127.0.0.1:5500',
    'null', // file:// local opening
  ];

  const originAllowed = allowedOrigins.some(allowed =>
    allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
  );

  res.setHeader('Access-Control-Allow-Origin', originAllowed ? origin : '');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Validate API key exists
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const { system, messages, max_tokens = 1500 } = req.body;

    // Validate required fields
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required.' });
    }

    // Call Claude API from server
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('Anthropic API error:', response.status, err);
      return res.status(response.status).json({
        error: `Anthropic API error: ${response.status}`,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error.' });
  }
}
