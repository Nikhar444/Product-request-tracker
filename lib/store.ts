// lib/store.ts
// Subscription persistence — Vercel KV when available, in-memory fallback

import type { Subscription, SubscriptionType } from "@/types";

let kv: any = null;

async function getKV() {
  if (kv) return kv;
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const mod = await import("@vercel/kv");
      kv = mod.kv;
      return kv;
    } catch {}
  }
  return null;
}

const mem = {
  subs: new Map<string, Subscription>(),
  logs: [] as Array<{ jiraKey: string; email: string; event: string; at: string; ok: boolean }>,
};

function subKey(jiraKey: string, email: string) {
  return `sub:${jiraKey}:${email.toLowerCase()}`;
}

export async function subscribe(
  email: string, jiraKey: string, type: SubscriptionType
): Promise<Subscription> {
  const sub: Subscription = {
    id: subKey(jiraKey, email),
    email: email.toLowerCase(),
    jiraKey,
    type,
    createdAt: new Date().toISOString(),
    active: true,
  };

  const store = await getKV();
  if (store) {
    await store.set(sub.id, JSON.stringify(sub));
    const idx: string[] = (await store.get(`idx:${jiraKey}`)) || [];
    if (!idx.includes(sub.id)) { idx.push(sub.id); await store.set(`idx:${jiraKey}`, idx); }
  } else {
    mem.subs.set(sub.id, sub);
  }
  return sub;
}

export async function getSubscribers(
  jiraKey: string, filterType?: SubscriptionType
): Promise<Subscription[]> {
  const store = await getKV();
  if (store) {
    const ids: string[] = (await store.get(`idx:${jiraKey}`)) || [];
    const subs: Subscription[] = [];
    for (const id of ids) {
      const raw = await store.get(id);
      if (raw) {
        const s: Subscription = typeof raw === "string" ? JSON.parse(raw) : raw;
        if (s.active && (!filterType || s.type === filterType)) subs.push(s);
      }
    }
    return subs;
  }
  return Array.from(mem.subs.values()).filter(
    (s) => s.jiraKey === jiraKey && s.active && (!filterType || s.type === filterType)
  );
}

export async function unsubscribe(jiraKey: string, email: string): Promise<boolean> {
  const key = subKey(jiraKey, email);
  const store = await getKV();
  if (store) {
    const raw = await store.get(key);
    if (raw) {
      const s: Subscription = typeof raw === "string" ? JSON.parse(raw) : raw;
      s.active = false;
      await store.set(key, JSON.stringify(s));
      return true;
    }
    return false;
  }
  const s = mem.subs.get(key);
  if (s) { s.active = false; return true; }
  return false;
}

export async function logNotification(entry: {
  jiraKey: string; email: string; event: string; ok: boolean;
}) {
  const log = { ...entry, at: new Date().toISOString() };
  const store = await getKV();
  if (store) {
    const k = `log:${entry.jiraKey}:${Date.now()}`;
    await store.set(k, JSON.stringify(log));
    await store.expire(k, 60 * 60 * 24 * 90);
  } else {
    mem.logs.push(log);
    if (mem.logs.length > 1000) mem.logs.splice(0, 500);
  }
}
