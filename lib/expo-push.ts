import { logServerError } from "@/lib/server-errors";

const EXPO_PUSH_API_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_CHUNK_SIZE = 100;

export type ExpoPushMessage = {
  body: string;
  channelId?: string;
  data?: Record<string, string | number | boolean | null>;
  sound?: "default";
  title: string;
  to: string;
};

type ExpoPushTicket = {
  id?: string;
  message?: string;
  status?: "error" | "ok";
};

type ExpoPushResponse = {
  data?: ExpoPushTicket | ExpoPushTicket[];
  errors?: unknown;
};

function chunkMessages(messages: ExpoPushMessage[]) {
  const chunks: ExpoPushMessage[][] = [];

  for (let index = 0; index < messages.length; index += EXPO_PUSH_CHUNK_SIZE) {
    chunks.push(messages.slice(index, index + EXPO_PUSH_CHUNK_SIZE));
  }

  return chunks;
}

function getTokenTail(token: string) {
  return token.slice(-8);
}

export async function sendExpoPushMessages(messages: ExpoPushMessage[]) {
  const failedTokenTails: string[] = [];

  for (const chunk of chunkMessages(messages)) {
    try {
      const response = await fetch(EXPO_PUSH_API_URL, {
        body: JSON.stringify(chunk),
        headers: {
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN
            ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
            : {}),
        },
        method: "POST",
      });
      const data = (await response.json().catch(() => null)) as ExpoPushResponse | null;

      if (!response.ok) {
        logServerError(new Error(`Expo Push API returned ${response.status}`), {
          action: "sendExpoPushMessages",
          details: { messageCount: chunk.length },
        });
        failedTokenTails.push(...chunk.map((message) => getTokenTail(message.to)));
        continue;
      }

      const tickets = Array.isArray(data?.data)
        ? data.data
        : data?.data
          ? [data.data]
          : [];

      tickets.forEach((ticket, index) => {
        if (ticket.status !== "error") return;
        failedTokenTails.push(getTokenTail(chunk[index]?.to ?? ""));
        logServerError(new Error(ticket.message ?? "Expo Push ticket error"), {
          action: "sendExpoPushMessages",
          details: { tokenTail: getTokenTail(chunk[index]?.to ?? "") },
        });
      });
    } catch (error) {
      logServerError(error, {
        action: "sendExpoPushMessages",
        details: { messageCount: chunk.length },
      });
      failedTokenTails.push(...chunk.map((message) => getTokenTail(message.to)));
    }
  }

  return { failedTokenTails };
}
