import { randomBytes } from "node:crypto";
import { get, put, BlobPreconditionFailedError } from "@vercel/blob";

export const LIMIT = 25;
const DAY = 86_400_000;
const NAME = "hydra_chat_session";

export function browserSession(request, now) {
  const value = request.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((p) => p.startsWith(NAME + "="))
    ?.slice(NAME.length + 1);
  if (!value || !/^\d{13}\.[a-f0-9]{48}$/.test(value)) return null;
  const start = Number(value.slice(0, 13));
  return start <= now && start + DAY > now ? { id: value, expires: start + DAY } : null;
}

export function startSession(request, now) {
  const id = now + "." + randomBytes(24).toString("hex");
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return {
    id,
    expires: now + DAY,
    cookie: NAME + "=" + id + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400" + secure,
  };
}

export function allowance(used, session) {
  return { limit: LIMIT, remaining: LIMIT - used, expires: session.expires };
}

// Local development has one process. Hosted workers share one private counter per browser.
export function memoryCounters() {
  const entries = new Map();
  return {
    async read(session) {
      return entries.get(session.id)?.used || 0;
    },
    async take(session, now) {
      for (const [key, row] of entries) if (row.expires <= now) entries.delete(key);
      const used = entries.get(session.id)?.used || 0;
      if (used >= LIMIT) return null;
      entries.set(session.id, { used: used + 1, expires: session.expires });
      return used + 1;
    },
  };
}

export function blobCounters(token, client = { get, put }) {
  const options = { token, access: "private" };
  const path = (session) => "sessions/" + session.id + ".txt";
  async function read(session) {
    const result = await client.get(path(session), {
      ...options,
      useCache: false,
      abortSignal: AbortSignal.timeout(4000),
    });
    if (result === null) return { used: 0 };
    if (result.statusCode !== 200 || !result.blob.etag) throw new Error("Unreadable counter");
    const value = await new Response(result.stream).text();
    if (!/^(?:[1-9]|1\d|2[0-5])$/.test(value)) throw new Error("Invalid counter");
    return { used: Number(value), etag: result.blob.etag };
  }
  return {
    async read(session) {
      return (await read(session)).used;
    },
    async take(session) {
      // Only the writer that wins the conditional update can start an external call.
      for (let attempt = 0; attempt < 3; attempt++) {
        const { used, etag } = await read(session);
        if (used >= LIMIT) return null;
        try {
          await client.put(path(session), String(used + 1), {
            ...options,
            addRandomSuffix: false,
            ttlDays: 1,
            contentType: "text/plain",
            allowOverwrite: Boolean(etag),
            ...(etag && { ifMatch: etag }),
            abortSignal: AbortSignal.timeout(4000),
          });
          return used + 1;
        } catch (error) {
          if (
            !(error instanceof BlobPreconditionFailedError) &&
            !/already exists|precondition failed/i.test(error.message)
          )
            throw error;
        }
      }
      throw new Error("Concurrent counter update");
    },
  };
}

export function counterStore(env) {
  if (env.HYDRA_CHAT_READ_WRITE_TOKEN) return blobCounters(env.HYDRA_CHAT_READ_WRITE_TOKEN);
  if (env.VERCEL) {
    const unavailable = async () => {
      throw new Error("Session store unconfigured");
    };
    return { read: unavailable, take: unavailable };
  }
  return memoryCounters();
}
