import { describe, expect, it } from "vitest";
import { decodeBase64Url, gmailQuery, messageText, orderOnInVietnam } from "./gmail";

describe("gmail helpers", () => {
  it("searches Grab mail through the end of Friday", () => {
    expect(gmailQuery("2026-11-16", "2026-11-20")).toBe(
      "after:2026/11/16 before:2026/11/21 (from:grab.com OR from:grab.vn)",
    );
  });

  it("reads the Vietnam calendar date from a mail timestamp", () => {
    expect(orderOnInVietnam(Date.parse("2026-11-20T17:30:00.000Z"))).toBe("2026-11-21");
  });

  it("decodes the plain part of a Gmail message", () => {
    const text = decodeBase64Url(Buffer.from("GrabFood", "utf8").toString("base64url"));
    expect(messageText({
      mimeType: "multipart/alternative",
      parts: [{ mimeType: "text/plain", body: { data: Buffer.from("Tổng cộng 10.000đ", "utf8").toString("base64url") } }],
    })).toContain("Tổng cộng");
    expect(text).toBe("GrabFood");
  });
});
