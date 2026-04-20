module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, q, url } = req.query;
  const UA = 'Mozilla/5.0 (compatible; RedditOpinionRadar/1.0)';

  try {
    if (action === 'search') {
      // Search for relevant posts
      const searchUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(q)}&sort=relevance&t=year&limit=8&type=link`;
      const r = await fetch(searchUrl, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('Reddit search failed: ' + r.status);
      const data = await r.json();
      const posts = (data?.data?.children || [])
        .map(c => c.data)
        .filter(p => p.num_comments > 5 && !p.over_18)
        .slice(0, 4)
        .map(p => ({
          id: p.id,
          subreddit: p.subreddit,
          title: p.title,
          score: p.score,
          num_comments: p.num_comments,
          url: p.permalink,
        }));
      return res.status(200).json({ posts });
    }

    if (action === 'comments') {
      // Fetch top comments for a post
      const commentUrl = `https://www.reddit.com${url}.json?limit=80&sort=top&depth=1`;
      const r = await fetch(commentUrl, { headers: { 'User-Agent': UA } });
      if (!r.ok) throw new Error('Reddit comments failed: ' + r.status);
      const data = await r.json();
      const rawComments = data?.[1]?.data?.children || [];
      const comments = rawComments
        .filter(c => c.kind === 't1' && c.data.score > 0 && c.data.body && c.data.body !== '[deleted]' && c.data.body !== '[removed]')
        .sort((a, b) => b.data.score - a.data.score)
        .slice(0, 40)
        .map(c => ({
          body: c.data.body.replace(/\n+/g, ' ').slice(0, 280),
          score: c.data.score,
        }));
      return res.status(200).json({ comments });
    }

    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
