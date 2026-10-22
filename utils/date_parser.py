import re
import datetime
import calendar
from typing import Dict, Any, Optional
import zoneinfo

# Number word mapping for expressions like "in two weeks"
WORD_TO_NUMBER = {
    "a": 1,
    "an": 1,
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "eleven": 11,
    "twelve": 12,
}

DAYS_OF_WEEK = {
    "monday": 0,
    "mon": 0,
    "tuesday": 1,
    "tue": 1,
    "tues": 1,
    "wednesday": 2,
    "wed": 2,
    "thursday": 3,
    "thu": 3,
    "thur": 3,
    "thurs": 3,
    "friday": 4,
    "fri": 4,
    "saturday": 5,
    "sat": 5,
    "sunday": 6,
    "sun": 6,
}

VAGUE_PHRASES = {
    "soon", "later", "whenever", "asap", "someday", "next time",
    "at some point", "eventually", "tbd", "to be determined",
    "unspecified", "when possible", "pending"
}

def get_tz(tz_name: Optional[str]) -> datetime.tzinfo:
    """Safely retrieves a ZoneInfo timezone or defaults to UTC."""
    if not tz_name:
        return datetime.timezone.utc
    try:
        return zoneinfo.ZoneInfo(tz_name.strip())
    except Exception:
        return datetime.timezone.utc

def add_business_days(start_date: datetime.date, num_days: int) -> datetime.date:
    """Adds N business days (skipping Saturday and Sunday)."""
    current = start_date
    added = 0
    while added < num_days:
        current += datetime.timedelta(days=1)
        if current.weekday() < 5:  # Monday to Friday
            added += 1
    return current

def parse_time_str(time_str: str) -> Optional[datetime.time]:
    """
    Parses strings like '3 PM', '3:30 PM', '15:00', '15:30:00', '9am'.
    """
    cleaned = time_str.strip().upper()
    
    # 12-hour format with AM/PM: e.g. 3 PM, 3:30 PM, 03:15PM
    m12 = re.match(r"^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?\s*(AM|PM)$", cleaned)
    if m12:
        hour = int(m12.group(1))
        minute = int(m12.group(2) or 0)
        second = int(m12.group(3) or 0)
        meridiem = m12.group(4)
        if hour < 1 or hour > 12 or minute < 0 or minute > 59 or second < 0 or second > 59:
            return None
        if meridiem == "AM":
            hour = 0 if hour == 12 else hour
        else:
            hour = 12 if hour == 12 else hour + 12
        return datetime.time(hour, minute, second)

    # 24-hour format: e.g. 14:30, 09:00, 23:59:00
    m24 = re.match(r"^(\d{1,2}):(\d{2})(?::(\d{2}))?$", cleaned)
    if m24:
        hour = int(m24.group(1))
        minute = int(m24.group(2))
        second = int(m24.group(3) or 0)
        if 0 <= hour <= 23 and 0 <= minute <= 59 and 0 <= second <= 59:
            return datetime.time(hour, minute, second)

    return None

def calculate_countdown(deadline_dt: datetime.datetime, ref_dt: datetime.datetime, is_completed: bool = False) -> Dict[str, Any]:
    """Calculates human-readable countdown and status badge state."""
    diff = deadline_dt - ref_dt
    total_seconds = int(diff.total_seconds())
    
    if is_completed:
        return {
            "badge_status": "completed",
            "countdown_seconds": total_seconds,
            "countdown_text": "Completed"
        }

    if total_seconds < 0:
        overdue_sec = abs(total_seconds)
        if overdue_sec < 3600:
            text = f"Overdue by {overdue_sec // 60}m"
        elif overdue_sec < 86400:
            text = f"Overdue by {overdue_sec // 3600}h"
        else:
            text = f"Overdue by {overdue_sec // 86400}d"
        return {
            "badge_status": "overdue",
            "countdown_seconds": total_seconds,
            "countdown_text": text
        }
    
    # Check if due today in local date
    if deadline_dt.date() == ref_dt.date():
        hours_left = max(1, total_seconds // 3600)
        return {
            "badge_status": "due_today",
            "countdown_seconds": total_seconds,
            "countdown_text": f"Due today ({hours_left}h remaining)"
        }
    
    # Within 48 hours: due soon
    if total_seconds <= 172800:
        hours = total_seconds // 3600
        return {
            "badge_status": "due_soon",
            "countdown_seconds": total_seconds,
            "countdown_text": f"Due in {hours}h"
        }
        
    # Upcoming: >= 2 days
    days = total_seconds // 86400
    if days < 14:
        text = f"Due in {days} days"
    else:
        weeks = days // 7
        text = f"Due in {weeks} weeks"
        
    return {
        "badge_status": "upcoming",
        "countdown_seconds": total_seconds,
        "countdown_text": text
    }

def parse_natural_deadline(
    text: str,
    reference_datetime: Optional[datetime.datetime] = None,
    timezone_str: str = "UTC",
    is_completed: bool = False
) -> Dict[str, Any]:
    """
    Deterministically parses a natural-language deadline phrase relative to reference_datetime and timezone.
    Returns a structured dictionary with parse status, ISO timestamp, timezone, and countdown metadata.
    """
    raw_input = (text or "").strip()
    if not raw_input:
        return {
            "status": "unsupported",
            "raw_input": raw_input,
            "parsed_iso": None,
            "formatted_local": None,
            "timezone": timezone_str,
            "is_date_only": True,
            "countdown_seconds": None,
            "countdown_text": "No deadline set",
            "badge_status": "no_deadline",
            "error_message": "Empty deadline input"
        }

    tz = get_tz(timezone_str)
    if reference_datetime is None:
        ref_dt = datetime.datetime.now(tz)
    else:
        if reference_datetime.tzinfo is None:
            ref_dt = reference_datetime.replace(tzinfo=tz)
        else:
            ref_dt = reference_datetime.astimezone(tz)

    normalized = raw_input.lower().strip()
    # Strip common leading prepositions
    normalized = re.sub(r"^(by|due|on|before|at|until)\s+", "", normalized).strip()

    # 1. Check for vague or ambiguous phrases
    if normalized in VAGUE_PHRASES or any(normalized == v for v in VAGUE_PHRASES):
        return {
            "status": "needs_clarification",
            "raw_input": raw_input,
            "parsed_iso": None,
            "formatted_local": None,
            "timezone": str(tz),
            "is_date_only": False,
            "countdown_seconds": None,
            "countdown_text": "Unconfirmed deadline",
            "badge_status": "unconfirmed",
            "clarification_question": f"The deadline '{raw_input}' is open to interpretation. Could you specify an explicit date, business days, or time?"
        }

    # Default end-of-day time: 17:00 (5:00 PM)
    default_eod_time = datetime.time(17, 0, 0)
    target_dt: Optional[datetime.datetime] = None
    is_date_only = True

    # 2. Check for relative minutes / hours: e.g. "in 90 minutes", "in 2 hours", "in 30 mins"
    m_rel_time = re.match(r"^in\s+(\d+|[a-z]+)\s*(minutes?|mins?|hours?|hrs?)$", normalized)
    if m_rel_time:
        num_raw = m_rel_time.group(1)
        num_val = int(num_raw) if num_raw.isdigit() else WORD_TO_NUMBER.get(num_raw)
        unit = m_rel_time.group(2)
        if num_val is not None and num_val > 0:
            if "min" in unit:
                target_dt = ref_dt + datetime.timedelta(minutes=num_val)
            else:
                target_dt = ref_dt + datetime.timedelta(hours=num_val)
            is_date_only = False

    # 3. Check for business days: e.g. "in 2 business days", "in 3 working days"
    m_biz = re.match(r"^in\s+(\d+|[a-z]+)\s*(?:business|working)\s*days?$", normalized)
    if not target_dt and m_biz:
        num_raw = m_biz.group(1)
        num_val = int(num_raw) if num_raw.isdigit() else WORD_TO_NUMBER.get(num_raw)
        if num_val is not None and num_val > 0:
            biz_date = add_business_days(ref_dt.date(), num_val)
            target_dt = datetime.datetime.combine(biz_date, default_eod_time, tzinfo=tz)
            is_date_only = True

    # 4. Check for relative days/weeks: e.g. "in 3 days", "in two weeks", "in 1 week"
    m_rel_days = re.match(r"^in\s+(\d+|[a-z]+)\s*(days?|weeks?)$", normalized)
    if not target_dt and m_rel_days:
        num_raw = m_rel_days.group(1)
        num_val = int(num_raw) if num_raw.isdigit() else WORD_TO_NUMBER.get(num_raw)
        unit = m_rel_days.group(2)
        if num_val is not None and num_val > 0:
            days_to_add = num_val * 7 if "week" in unit else num_val
            target_date = ref_dt.date() + datetime.timedelta(days=days_to_add)
            target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
            is_date_only = True

    # 5. Check for "end of this month" / "end of the month" / "end of month"
    if not target_dt and re.search(r"end\s+of\s+(?:this\s+|the\s+)?month", normalized):
        year = ref_dt.year
        month = ref_dt.month
        last_day = calendar.monthrange(year, month)[1]
        target_date = datetime.date(year, month, last_day)
        target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
        is_date_only = True

    # 6. Check for "next month"
    if not target_dt and normalized in ["next month", "by next month"]:
        year = ref_dt.year + (1 if ref_dt.month == 12 else 0)
        month = 1 if ref_dt.month == 12 else ref_dt.month + 1
        # Try same day next month, or last day of next month if fewer days
        max_days = calendar.monthrange(year, month)[1]
        day = min(ref_dt.day, max_days)
        target_date = datetime.date(year, month, day)
        target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
        is_date_only = True

    # 7. Check for "tomorrow" (with optional time): e.g. "tomorrow", "tomorrow at 3 PM", "tomorrow EOD"
    m_tomorrow = re.match(r"^tomorrow(?:\s+at\s+(.+?)|\s+eod)?$", normalized)
    if not target_dt and m_tomorrow:
        tomorrow_date = ref_dt.date() + datetime.timedelta(days=1)
        time_part = m_tomorrow.group(1)
        if time_part:
            parsed_time = parse_time_str(time_part)
            if parsed_time:
                target_dt = datetime.datetime.combine(tomorrow_date, parsed_time, tzinfo=tz)
                is_date_only = False
            else:
                return {
                    "status": "invalid",
                    "raw_input": raw_input,
                    "parsed_iso": None,
                    "formatted_local": None,
                    "timezone": str(tz),
                    "is_date_only": False,
                    "countdown_seconds": None,
                    "countdown_text": "Invalid time specification",
                    "badge_status": "unconfirmed",
                    "error_message": f"Unable to parse time portion '{time_part}'."
                }
        else:
            target_dt = datetime.datetime.combine(tomorrow_date, default_eod_time, tzinfo=tz)
            is_date_only = True

    # 8. Check for weekdays: e.g. "next Friday", "this coming Monday", "Friday at 3 PM", "by Friday EOD", "next week Friday"
    m_weekday = re.match(
        r"^(?:this\s+coming\s+|this\s+|next\s+week\s+|next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)(?:\s+at\s+(.+?)|\s+eod)?$",
        normalized
    )
    if not target_dt and m_weekday:
        day_name = m_weekday.group(1)
        target_weekday = DAYS_OF_WEEK[day_name]
        is_next = "next" in normalized
        current_weekday = ref_dt.weekday()
        
        days_ahead = (target_weekday - current_weekday) % 7
        if days_ahead == 0:
            # Same day: if marked "next", jump to next week (7 days); if today, default to next occurrence (7 days)
            days_ahead = 7
        elif is_next and "next week" in normalized and days_ahead < 7:
            days_ahead += 7
            
        target_date = ref_dt.date() + datetime.timedelta(days=days_ahead)
        time_part = m_weekday.group(2)
        if time_part:
            parsed_time = parse_time_str(time_part)
            if parsed_time:
                target_dt = datetime.datetime.combine(target_date, parsed_time, tzinfo=tz)
                is_date_only = False
            else:
                return {
                    "status": "invalid",
                    "raw_input": raw_input,
                    "parsed_iso": None,
                    "formatted_local": None,
                    "timezone": str(tz),
                    "is_date_only": False,
                    "countdown_seconds": None,
                    "countdown_text": "Invalid time specification",
                    "badge_status": "unconfirmed",
                    "error_message": f"Unable to parse time portion '{time_part}'."
                }
        else:
            target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
            is_date_only = True

    # 9. Check for ISO date with optional time: e.g. "2026-11-05", "2026-11-05 at 14:30", "2026-11-05 14:30", "2026-11-05T14:30:00"
    m_iso = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s]+(?:at\s+)?(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?|\d{1,2}\s*[AP]M))?$", normalized, re.IGNORECASE)
    if not target_dt and m_iso:
        y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
        time_part = m_iso.group(4)
        try:
            target_date = datetime.date(y, m, d)
        except ValueError as e:
            return {
                "status": "invalid",
                "raw_input": raw_input,
                "parsed_iso": None,
                "formatted_local": None,
                "timezone": str(tz),
                "is_date_only": True,
                "countdown_seconds": None,
                "countdown_text": "Invalid calendar date",
                "badge_status": "unconfirmed",
                "error_message": f"Invalid calendar date: {e}."
            }
            
        if time_part:
            parsed_time = parse_time_str(time_part)
            if parsed_time:
                target_dt = datetime.datetime.combine(target_date, parsed_time, tzinfo=tz)
                is_date_only = False
            else:
                target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
                is_date_only = True
        else:
            target_dt = datetime.datetime.combine(target_date, default_eod_time, tzinfo=tz)
            is_date_only = True

    # 10. Check for "today EOD" or "today"
    if not target_dt and normalized in ["today", "today eod", "eod"]:
        target_dt = datetime.datetime.combine(ref_dt.date(), default_eod_time, tzinfo=tz)
        is_date_only = True

    # If still not matched, return unsupported
    if not target_dt:
        return {
            "status": "unsupported",
            "raw_input": raw_input,
            "parsed_iso": None,
            "formatted_local": None,
            "timezone": str(tz),
            "is_date_only": True,
            "countdown_seconds": None,
            "countdown_text": "Unsupported format",
            "badge_status": "unconfirmed",
            "error_message": f"Deadline phrase '{raw_input}' could not be parsed."
        }

    # Calculate countdown relative to ref_dt
    countdown_info = calculate_countdown(target_dt, ref_dt, is_completed=is_completed)

    # Format human-friendly local string
    if is_date_only:
        fmt_local = target_dt.strftime("%A, %b %d, %Y (EOD 5:00 PM %Z)")
    else:
        fmt_local = target_dt.strftime("%A, %b %d, %Y at %I:%M %p %Z")

    return {
        "status": "success",
        "raw_input": raw_input,
        "parsed_iso": target_dt.isoformat(),
        "formatted_local": fmt_local,
        "timezone": str(tz),
        "is_date_only": is_date_only,
        "countdown_seconds": countdown_info["countdown_seconds"],
        "countdown_text": countdown_info["countdown_text"],
        "badge_status": countdown_info["badge_status"],
        "clarification_question": None
    }
