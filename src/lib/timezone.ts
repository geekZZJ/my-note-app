import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { addDays, parseISO } from "date-fns";

export const TIMEZONE = "Asia/Shanghai";

export function todayDateString(now = new Date()): string {
  return formatInTimeZone(now, TIMEZONE, "yyyy-MM-dd");
}

export function formatTime(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "HH:mm");
}

export function formatDateTime(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd HH:mm:ss");
}

/** 上海时区某一天的 [start, end) UTC 边界 */
export function dayRange(dateStr: string): { start: Date; end: Date } {
  const start = fromZonedTime(`${dateStr}T00:00:00.000`, TIMEZONE);
  const next = formatInTimeZone(
    addDays(toZonedTime(start, TIMEZONE), 1),
    TIMEZONE,
    "yyyy-MM-dd",
  );
  const end = fromZonedTime(`${next}T00:00:00.000`, TIMEZONE);
  return { start, end };
}

export function parseHappenedAt(input: unknown, fallback = new Date()): Date {
  if (input === null || input === undefined || input === "") {
    return fallback;
  }
  if (typeof input !== "string") {
    throw new Error("时间格式无效");
  }
  // 支持 "YYYY-MM-DDTHH:mm" 或带秒，按上海时区解释
  const normalized = input.length === 16 ? `${input}:00` : input;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(normalized)) {
    return fromZonedTime(normalized.slice(0, 19), TIMEZONE);
  }
  const parsed = parseISO(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("时间格式无效");
  }
  return parsed;
}

export function toDatetimeLocalValue(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd'T'HH:mm");
}

export function dateStringOf(date: Date): string {
  return formatInTimeZone(date, TIMEZONE, "yyyy-MM-dd");
}
