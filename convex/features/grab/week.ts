const TIME_ZONE = "Asia/Ho_Chi_Minh";

const weekdayIndex: Record<string, number> = {
  Mon: 0,
  Tue: 1,
  Wed: 2,
  Thu: 3,
  Fri: 4,
  Sat: 5,
  Sun: 6,
};

export type WorkWeek = {
  from: string;
  to: string;
};

function zonedCalendar(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekday = read("weekday");
  const index = weekdayIndex[weekday];
  if (index === undefined) {
    throw new Error(`Không đọc được thứ trong tuần: ${weekday}`);
  }
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    index,
  };
}

function isoDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function currentWorkWeek(now = new Date()): WorkWeek {
  const { year, month, day, index } = zonedCalendar(now);
  return {
    from: isoDate(year, month, day - index),
    to: isoDate(year, month, day - index + 4),
  };
}

export function assertWorkWeek(from: string, to: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    throw new Error("Khoảng ngày phải có dạng YYYY-MM-DD.");
  }
  if (from > to) {
    throw new Error("Ngày bắt đầu phải trước hoặc trùng ngày kết thúc.");
  }
}
