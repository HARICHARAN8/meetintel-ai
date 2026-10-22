export interface ParsedDeadlineResult {
  status: "success" | "needs_clarification" | "invalid" | "unsupported";
  rawInput: string;
  parsedIso: string | null;
  formattedLocal: string | null;
  timezone: string;
  isDateOnly: boolean;
  countdownSeconds: number | null;
  countdownText: string;
  badgeStatus: "overdue" | "due_today" | "due_soon" | "upcoming" | "completed" | "no_deadline" | "unconfirmed";
  clarificationQuestion?: string;
  errorMessage?: string;
}

const WORD_TO_NUMBER: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

const DAYS_OF_WEEK: Record<string, number> = {
  sunday: 0,
  sun: 0,
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  tues: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
};

const VAGUE_PHRASES = new Set([
  "soon", "later", "whenever", "asap", "someday", "next time",
  "at some point", "eventually", "tbd", "to be determined",
  "unspecified", "when possible", "pending"
]);

export function addBusinessDays(startDate: Date, numDays: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < numDays) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) {
      added++;
    }
  }
  return result;
}

export function parseTimeComponent(timeStr: string): { hour: number; minute: number; second: number } | null {
  const cleaned = timeStr.trim().toUpperCase();
  
  // 12-hour: 3 PM, 3:30 PM, 03:15PM
  const m12 = cleaned.match(/^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$/);
  if (m12) {
    let hour = parseInt(m12[1], 10);
    const minute = m12[2] ? parseInt(m12[2], 10) : 0;
    const second = m12[3] ? parseInt(m12[3], 10) : 0;
    const meridiem = m12[4];
    if (hour < 1 || hour > 12 || minute < 0 || minute > 59 || second < 0 || second > 59) return null;
    if (meridiem === "AM") {
      hour = hour === 12 ? 0 : hour;
    } else {
      hour = hour === 12 ? 12 : hour + 12;
    }
    return { hour, minute, second };
  }

  // 24-hour: 14:30, 09:00
  const m24 = cleaned.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const hour = parseInt(m24[1], 10);
    const minute = parseInt(m24[2], 10);
    const second = m24[3] ? parseInt(m24[3], 10) : 0;
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59 && second >= 0 && second <= 59) {
      return { hour, minute, second };
    }
  }

  return null;
}

export function calculateClientCountdown(
  deadlineDate: Date,
  refDate: Date,
  isCompleted: boolean = false
): { countdownSeconds: number; countdownText: string; badgeStatus: ParsedDeadlineResult["badgeStatus"] } {
  const diffMs = deadlineDate.getTime() - refDate.getTime();
  const totalSeconds = Math.floor(diffMs / 1000);

  if (isCompleted) {
    return {
      countdownSeconds: totalSeconds,
      countdownText: "Completed",
      badgeStatus: "completed",
    };
  }

  if (totalSeconds < 0) {
    const overdueSec = Math.abs(totalSeconds);
    let text = "";
    if (overdueSec < 3600) {
      text = `Overdue by ${Math.floor(overdueSec / 60)}m`;
    } else if (overdueSec < 86400) {
      text = `Overdue by ${Math.floor(overdueSec / 3600)}h`;
    } else {
      text = `Overdue by ${Math.floor(overdueSec / 86400)}d`;
    }
    return {
      countdownSeconds: totalSeconds,
      countdownText: text,
      badgeStatus: "overdue",
    };
  }

  if (
    deadlineDate.getFullYear() === refDate.getFullYear() &&
    deadlineDate.getMonth() === refDate.getMonth() &&
    deadlineDate.getDate() === refDate.getDate()
  ) {
    const hoursLeft = Math.max(1, Math.floor(totalSeconds / 3600));
    return {
      countdownSeconds: totalSeconds,
      countdownText: `Due today (${hoursLeft}h left)`,
      badgeStatus: "due_today",
    };
  }

  if (totalSeconds <= 172800) {
    const hours = Math.floor(totalSeconds / 3600);
    return {
      countdownSeconds: totalSeconds,
      countdownText: `Due in ${hours}h`,
      badgeStatus: "due_soon",
    };
  }

  const days = Math.floor(totalSeconds / 86400);
  if (days < 14) {
    return {
      countdownSeconds: totalSeconds,
      countdownText: `Due in ${days} days`,
      badgeStatus: "upcoming",
    };
  }

  const weeks = Math.floor(days / 7);
  return {
    countdownSeconds: totalSeconds,
    countdownText: `Due in ${weeks} weeks`,
    badgeStatus: "upcoming",
  };
}

export function parseNaturalDeadline(
  text: string,
  referenceDate?: Date,
  timezoneStr: string = "UTC",
  isCompleted: boolean = false
): ParsedDeadlineResult {
  const rawInput = (text || "").trim();
  if (!rawInput) {
    return {
      status: "unsupported",
      rawInput,
      parsedIso: null,
      formattedLocal: null,
      timezone: timezoneStr,
      isDateOnly: true,
      countdownSeconds: null,
      countdownText: "No deadline set",
      badgeStatus: "no_deadline",
      errorMessage: "Empty deadline input",
    };
  }

  const ref = referenceDate ? new Date(referenceDate) : new Date();
  let normalized = rawInput.toLowerCase().trim();
  normalized = normalized.replace(/^(by|due|on|before|at|until)\s+/i, "").trim();

  // 1. Check vague phrases
  if (VAGUE_PHRASES.has(normalized)) {
    return {
      status: "needs_clarification",
      rawInput,
      parsedIso: null,
      formattedLocal: null,
      timezone: timezoneStr,
      isDateOnly: false,
      countdownSeconds: null,
      countdownText: "Unconfirmed deadline",
      badgeStatus: "unconfirmed",
      clarificationQuestion: `The deadline '${rawInput}' is ambiguous. Would you prefer specifying an exact day (e.g. 'by Friday 5 PM') or relative timeframe?`,
    };
  }

  let target: Date | null = null;
  let isDateOnly = true;

  // 2. Relative minutes / hours: "in 90 minutes", "in 2 hours", "in 30 mins"
  const mRelTime = normalized.match(/^in\s+(\d+|[a-z]+)\s*(minutes?|mins?|hours?|hrs?)$/i);
  if (mRelTime) {
    const rawVal = mRelTime[1];
    const num = isNaN(Number(rawVal)) ? WORD_TO_NUMBER[rawVal] : parseInt(rawVal, 10);
    const unit = mRelTime[2];
    if (num && num > 0) {
      target = new Date(ref);
      if (unit.startsWith("min")) {
        target.setMinutes(target.getMinutes() + num);
      } else {
        target.setHours(target.getHours() + num);
      }
      isDateOnly = false;
    }
  }

  // 3. Business days: "in 2 business days"
  const mBiz = normalized.match(/^in\s+(\d+|[a-z]+)\s*(?:business|working)\s*days?$/i);
  if (!target && mBiz) {
    const rawVal = mBiz[1];
    const num = isNaN(Number(rawVal)) ? WORD_TO_NUMBER[rawVal] : parseInt(rawVal, 10);
    if (num && num > 0) {
      target = addBusinessDays(ref, num);
      target.setHours(17, 0, 0, 0);
      isDateOnly = true;
    }
  }

  // 4. Relative days/weeks: "in 3 days", "in two weeks"
  const mRelDays = normalized.match(/^in\s+(\d+|[a-z]+)\s*(days?|weeks?)$/i);
  if (!target && mRelDays) {
    const rawVal = mRelDays[1];
    const num = isNaN(Number(rawVal)) ? WORD_TO_NUMBER[rawVal] : parseInt(rawVal, 10);
    const unit = mRelDays[2];
    if (num && num > 0) {
      target = new Date(ref);
      const daysToAdd = unit.startsWith("week") ? num * 7 : num;
      target.setDate(target.getDate() + daysToAdd);
      target.setHours(17, 0, 0, 0);
      isDateOnly = true;
    }
  }

  // 5. End of this month: "by the end of this month", "end of month"
  if (!target && /end\s+of\s+(?:this\s+|the\s+)?month/i.test(normalized)) {
    target = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 17, 0, 0, 0);
    isDateOnly = true;
  }

  // 6. Next month
  if (!target && (normalized === "next month" || normalized === "by next month")) {
    const nextMonth = ref.getMonth() + 1;
    const year = ref.getFullYear() + (nextMonth > 11 ? 1 : 0);
    const month = nextMonth % 12;
    const maxDays = new Date(year, month + 1, 0).getDate();
    const day = Math.min(ref.getDate(), maxDays);
    target = new Date(year, month, day, 17, 0, 0, 0);
    isDateOnly = true;
  }

  // 7. Tomorrow
  const mTomorrow = normalized.match(/^tomorrow(?:\s+at\s+(.+?)|\s+eod)?$/i);
  if (!target && mTomorrow) {
    target = new Date(ref);
    target.setDate(target.getDate() + 1);
    const timePart = mTomorrow[1];
    if (timePart) {
      const parsedTime = parseTimeComponent(timePart);
      if (parsedTime) {
        target.setHours(parsedTime.hour, parsedTime.minute, parsedTime.second, 0);
        isDateOnly = false;
      } else {
        return {
          status: "invalid",
          rawInput,
          parsedIso: null,
          formattedLocal: null,
          timezone: timezoneStr,
          isDateOnly: false,
          countdownSeconds: null,
          countdownText: "Invalid time format",
          badgeStatus: "unconfirmed",
          errorMessage: `Cannot interpret time portion '${timePart}'.`,
        };
      }
    } else {
      target.setHours(17, 0, 0, 0);
      isDateOnly = true;
    }
  }

  // 8. Weekdays: "next Friday", "this coming Monday", "Friday at 3 PM", "by Friday EOD"
  const mWeekday = normalized.match(
    /^(?:this\s+coming\s+|this\s+|next\s+week\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:\s+at\s+(.+?)|\s+eod)?$/i
  );
  if (!target && mWeekday) {
    const dayName = mWeekday[1].toLowerCase();
    const targetDay = DAYS_OF_WEEK[dayName];
    const currentDay = ref.getDay();
    let daysAhead = (targetDay - currentDay + 7) % 7;
    if (daysAhead === 0) {
      daysAhead = 7;
    } else if (normalized.includes("next week") && daysAhead < 7) {
      daysAhead += 7;
    }
    target = new Date(ref);
    target.setDate(target.getDate() + daysAhead);
    const timePart = mWeekday[2];
    if (timePart) {
      const parsedTime = parseTimeComponent(timePart);
      if (parsedTime) {
        target.setHours(parsedTime.hour, parsedTime.minute, parsedTime.second, 0);
        isDateOnly = false;
      } else {
        return {
          status: "invalid",
          rawInput,
          parsedIso: null,
          formattedLocal: null,
          timezone: timezoneStr,
          isDateOnly: false,
          countdownSeconds: null,
          countdownText: "Invalid time format",
          badgeStatus: "unconfirmed",
          errorMessage: `Cannot interpret time portion '${timePart}'.`,
        };
      }
    } else {
      target.setHours(17, 0, 0, 0);
      isDateOnly = true;
    }
  }

  // 9. ISO date: "2026-11-05", "2026-11-05 at 14:30"
  const mIso = normalized.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?|\d{1,2}\s*[AP]M))?$/i
  );
  if (!target && mIso) {
    const y = parseInt(mIso[1], 10);
    const m = parseInt(mIso[2], 10) - 1;
    const d = parseInt(mIso[3], 10);
    const testDate = new Date(y, m, d);
    if (testDate.getFullYear() !== y || testDate.getMonth() !== m || testDate.getDate() !== d) {
      return {
        status: "invalid",
        rawInput,
        parsedIso: null,
        formattedLocal: null,
        timezone: timezoneStr,
        isDateOnly: true,
        countdownSeconds: null,
        countdownText: "Invalid calendar date",
        badgeStatus: "unconfirmed",
        errorMessage: `The calendar date ${y}-${m + 1}-${d} does not exist.`,
      };
    }
    target = new Date(y, m, d);
    const timePart = mIso[4];
    if (timePart) {
      const parsedTime = parseTimeComponent(timePart);
      if (parsedTime) {
        target.setHours(parsedTime.hour, parsedTime.minute, parsedTime.second, 0);
        isDateOnly = false;
      } else {
        target.setHours(17, 0, 0, 0);
        isDateOnly = true;
      }
    } else {
      target.setHours(17, 0, 0, 0);
      isDateOnly = true;
    }
  }

  // 10. Today
  if (!target && (normalized === "today" || normalized === "today eod" || normalized === "eod")) {
    target = new Date(ref);
    target.setHours(17, 0, 0, 0);
    isDateOnly = true;
  }

  // Fallback: If standard Date.parse works for phrases like "October 24, 2026"
  if (!target) {
    const parsedTs = Date.parse(rawInput);
    if (!isNaN(parsedTs)) {
      target = new Date(parsedTs);
      isDateOnly = !rawInput.includes(":") && !rawInput.toLowerCase().includes("am") && !rawInput.toLowerCase().includes("pm");
      if (isDateOnly) {
        target.setHours(17, 0, 0, 0);
      }
    }
  }

  if (!target) {
    return {
      status: "unsupported",
      rawInput,
      parsedIso: null,
      formattedLocal: null,
      timezone: timezoneStr,
      isDateOnly: true,
      countdownSeconds: null,
      countdownText: "Unsupported format",
      badgeStatus: "unconfirmed",
      errorMessage: `Could not interpret phrase '${rawInput}'.`,
    };
  }

  const countdown = calculateClientCountdown(target, ref, isCompleted);
  const dateStr = target.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timeStr = target.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  const formattedLocal = isDateOnly ? `${dateStr} (EOD 5:00 PM)` : `${dateStr} at ${timeStr}`;

  return {
    status: "success",
    rawInput,
    parsedIso: target.toISOString(),
    formattedLocal,
    timezone: timezoneStr,
    isDateOnly,
    countdownSeconds: countdown.countdownSeconds,
    countdownText: countdown.countdownText,
    badgeStatus: countdown.badgeStatus,
  };
}
