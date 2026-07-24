// Expo push API adapter (contracts/evaluate-reminders-function.md) — this
// function's Deno-side equivalent of notificationScheduler.ts's
// expo-notifications calls.
const SEND_URL = "https://exp.host/--/api/v2/push/send";
const RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const MAX_BATCH_SIZE = 100; // Expo's documented per-request limit

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface ExpoPushTicket {
  status: "ok" | "error";
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface ExpoPushReceipt {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

/** Sends messages in batches of at most 100, returning one ticket per message in input order. */
export async function sendPushBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const tickets: ExpoPushTicket[] = [];
  for (const batch of chunk(messages, MAX_BATCH_SIZE)) {
    const response = await fetch(SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(batch),
    });
    if (!response.ok) {
      throw new Error(`Expo push send failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as { data: ExpoPushTicket[] };
    tickets.push(...body.data);
  }
  return tickets;
}

/** Looks up delivery receipts for previously-sent ticket ids (research.md #4). */
export async function getReceipts(ticketIds: string[]): Promise<Record<string, ExpoPushReceipt>> {
  if (ticketIds.length === 0) {
    return {};
  }
  const receipts: Record<string, ExpoPushReceipt> = {};
  for (const batch of chunk(ticketIds, MAX_BATCH_SIZE)) {
    const response = await fetch(RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: batch }),
    });
    if (!response.ok) {
      throw new Error(`Expo getReceipts failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as { data: Record<string, ExpoPushReceipt> };
    Object.assign(receipts, body.data);
  }
  return receipts;
}
