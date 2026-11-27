export function gmailQuery(from: string, to: string) {
  const [year, month, day] = to.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const before = [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("/");
  return `after:${from.replaceAll("-", "/")} before:${before} (from:grab.com OR from:grab.vn)`;
}

export function orderOnInVietnam(epochMs: number) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(epochMs));
}

export function decodeBase64Url(data: string) {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

export type GmailPart = {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailPart[];
};

export function messageText(payload: GmailPart | undefined) {
  if (!payload) return "";
  const chunks: string[] = [];
  const walk = (part: GmailPart) => {
    if (part.body?.data && (part.mimeType === "text/plain" || part.mimeType === "text/html")) {
      chunks.push(decodeBase64Url(part.body.data));
    }
    part.parts?.forEach(walk);
  };
  walk(payload);
  if (chunks.length > 0) return chunks.join("\n");
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return "";
}
