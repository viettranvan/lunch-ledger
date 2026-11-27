import { describe, expect, it } from "vitest";
import { currentWorkWeek } from "./week";

describe("currentWorkWeek", () => {
  it("uses Monday through Friday of the week containing a Friday", () => {
    expect(currentWorkWeek(new Date("2026-11-20T03:00:00.000Z"))).toEqual({
      from: "2026-11-16",
      to: "2026-11-20",
    });
  });

  it("keeps the same work week on Sunday", () => {
    expect(currentWorkWeek(new Date("2026-11-22T15:00:00.000Z"))).toEqual({
      from: "2026-11-16",
      to: "2026-11-20",
    });
  });
});
