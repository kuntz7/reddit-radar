module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { provider = 'anthropic', system, messages, max_tokens = 1800 } = req.body;

  try {
    let text = '';

    // ── Anthropic ──────────────────────────────────────────────
    if (provider === 'anthropic') {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens, system, messages }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || 'Anthropic error ' + r.status);
      text = (data.content || []).map(b => b.text || '').join('');
    }

    // ── Google Gemini ──────────────────────────────────────────
    else if (provider === 'gemini') {
      const key = process.env.GEMINI_API_KEY;
      if (!key) throw new Error('GEMINI_API_KEY not configured');
      const userMessage = messages.filter(m => m.role === 'user').map(m => m.content).join('\n');
      const r = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + key,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: system }] },
            contents: [{ role: 'user', parts: [{ text: userMessage }] }],
            generationConfig: { maxOutputTokens: max_tokens },
          }),
        }
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || 'Gemini error ' + r.status);
      text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    // ── OpenAI ─────────────────────────────────────────────────
    else if (provider === 'openai') {
      const key = process.env.OPENAI_API_KEY;
      if (!key) throw new Error('OPENAI_API_KEY not configured');
      const r = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + key,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          max_tokens,
          messages: [{ role: 'system', content: system }, ...messages],
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data?.error?.message || 'OpenAI error ' + r.status);
      text = data?.choices?.[0]?.message?.content || '';
    }

    else {
      throw new Error('Unknown provider: ' + provider);
    }

    if (!text) throw new Error('Empty response from AI');
    return res.status(200).json({ text });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
