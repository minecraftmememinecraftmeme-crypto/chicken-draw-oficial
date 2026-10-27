// Chicken Gun — online server browser
// GET  /api/servers  -> { servers: [...] }
// POST /api/servers  -> create server

if (!globalThis.__cgServers) globalThis.__cgServers = [];

function clean(list) {
  const now = Date.now();
  return list.filter(s => now - (s.t || 0) < 2 * 60 * 60 * 1000).slice(0, 50);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    return res.end();
  }

  let servers = clean(globalThis.__cgServers || []);
  globalThis.__cgServers = servers;

  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    return res.end(JSON.stringify({ servers, ok: true }));
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (!body || typeof body === 'string') {
      try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString() || (typeof body === 'string' ? body : '{}');
        body = JSON.parse(raw || '{}');
      } catch (e) {
        body = typeof req.body === 'object' && req.body ? req.body : {};
      }
    }
    const entry = {
      id: Math.random().toString(36).slice(2, 10),
      name: String(body.name || 'Server').slice(0, 32),
      map: String(body.map || 'chalohouse').slice(0, 32),
      players: String(body.players || '1/8').slice(0, 16),
      maxPlayers: Number(body.maxPlayers) || 8,
      t: Date.now()
    };
    servers.unshift(entry);
    globalThis.__cgServers = servers.slice(0, 50);
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 201;
    return res.end(JSON.stringify(entry));
  }

  res.statusCode = 405;
  res.setHeader('Content-Type', 'application/json');
  return res.end(JSON.stringify({ error: 'Method not allowed' }));
};
