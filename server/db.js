const mem = new Map();

const hasReplitDb = !!process.env.REPLIT_DB_URL;

let client = null;
if (hasReplitDb) {
  const mod = await import("@replit/database");
  const Client = mod.default || mod.Client;
  client = new Client();
}

const unwrap = (res) => {
  if (res && typeof res === "object" && "ok" in res) {
    return res.ok ? res.value : null;
  }
  return res;
};

export const db = {
  async get(key) {
    if (client) {
      try { return unwrap(await client.get(key)) ?? null; }
      catch { return null; }
    }
    return mem.has(key) ? mem.get(key) : null;
  },
  async set(key, value) {
    if (client) {
      try { await client.set(key, value); } catch (e) { console.error("db.set", e); }
      return;
    }
    mem.set(key, value);
  },
};

export const usingReplitDb = hasReplitDb;
