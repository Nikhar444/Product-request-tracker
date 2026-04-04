// lib/store.ts
// Subscription and notification log persistence
// Uses Vercel KV when available, falls back to in-memory store

import type { Subscription, SubscriptionType } from "@/types";

// ─── Check if Vercel KV is available ──────────────────────

let kv: any = null;

async function getKV() {
  if (kv) return kv;

  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    try {
      const { kv: vercelKV } = await import("@vercel/kv");
      kv = vercelKV;
      console.log("[store] Using Vercel KV for persistence");
      return kv;
    } catch {
      console.warn("[store] Vercel KV import failed — using in-memory store");
    }
  }

  return null;
}

// ─── In-Memory Fallback ───────────────────────────────────
// WARNING: Resets on every deployment/cold start.
// Fine for development; use Vercel KV or a database for production.

const memoryStore = {
  subscriptions: new Map<string, Subscription>(),
  notificationLog: [] as Array<{
    requestId: number;
    email: string;
    eventType: string;
    sentAt: string;
    success: boolean;
  }>,
};

// ─── Subscription CRUD ────────────────────────────────────

function subscriptionKey(requestId: number, email: string): string {
  return `sub:${requestId}:${email.toLowerCase()}`;
}

export async function createSubscription(
  email: string,
  requestId: number,
  type: SubscriptionType,
  jiraKey?: string
): Promise<Subscription> {
  const sub: Subscription = {
    id: subscriptionKey(requestId, email),
    email: email.toLowerCase(),
    requestId,
    jiraKey,
    type,
    createdAt: new Date().toISOString(),
    active: true,
  };

  const store = await getKV();
  if (store) {
    await store.set(sub.id, JSON.stringify(sub));
    // Also maintain an index of subscriptions per request
    const indexKey = `sub-index:${requestId}`;
    const existing: string[] = (await store.get(indexKey)) || [];
    if (!existing.includes(sub.id)) {
      existing.push(sub.id);
      await store.set(indexKey, existing);
    }
  } else {
    memoryStore.subscriptions.set(sub.id, sub);
  }

  return sub;
}

export async function getSubscription(
  requestId: number,
  email: string
): Promise<Subscription | null> {
  const key = subscriptionKey(requestId, email);

  const store = await getKV();
  if (store) {
    const data = await store.get(key);
    return data ? (typeof data === "string" ? JSON.parse(data) : data) : null;
  }

  return memoryStore.subscriptions.get(key) || null;
}

export async function getSubscribersForRequest(
  requestId: number,
  filterType?: SubscriptionType
): Promise<Subscription[]> {
  const store = await getKV();

  if (store) {
    const indexKey = `sub-index:${requestId}`;
    const subIds: string[] = (await store.get(indexKey)) || [];
    const subs: Subscription[] = [];

    for (const id of subIds) {
      const data = await store.get(id);
      if (data) {
        const sub: Subscription =
          typeof data === "string" ? JSON.parse(data) : data;
        if (sub.active) {
          if (!filterType || sub.type === filterType) {
            subs.push(sub);
          }
        }
      }
    }

    return subs;
  }

  // Memory fallback
  const subs: Subscription[] = [];
  for (const sub of memoryStore.subscriptions.values()) {
    if (sub.requestId === requestId && sub.active) {
      if (!filterType || sub.type === filterType) {
        subs.push(sub);
      }
    }
  }
  return subs;
}

export async function unsubscribe(
  requestId: number,
  email: string
): Promise<boolean> {
  const key = subscriptionKey(requestId, email);

  const store = await getKV();
  if (store) {
    const data = await store.get(key);
    if (data) {
      const sub: Subscription =
        typeof data === "string" ? JSON.parse(data) : data;
      sub.active = false;
      await store.set(key, JSON.stringify(sub));
      return true;
    }
    return false;
  }

  const sub = memoryStore.subscriptions.get(key);
  if (sub) {
    sub.active = false;
    return true;
  }
  return false;
}

// ─── Notification Logging ─────────────────────────────────

export async function logNotification(entry: {
  requestId: number;
  email: string;
  eventType: string;
  success: boolean;
}): Promise<void> {
  const log = { ...entry, sentAt: new Date().toISOString() };

  const store = await getKV();
  if (store) {
    const logKey = `log:${entry.requestId}:${Date.now()}`;
    await store.set(logKey, JSON.stringify(log));
    // TTL: keep logs for 90 days
    await store.expire(logKey, 60 * 60 * 24 * 90);
  } else {
    memoryStore.notificationLog.push(log);
    // Keep memory log from growing unbounded
    if (memoryStore.notificationLog.length > 1000) {
      memoryStore.notificationLog.splice(0, 500);
    }
  }
}
