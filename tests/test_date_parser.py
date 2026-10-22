import datetime
import pytest
from utils.date_parser import parse_natural_deadline, add_business_days, parse_time_str

def test_tomorrow_parsing():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("tomorrow", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert res["parsed_iso"].startswith("2026-10-23T17:00:00")
    assert res["is_date_only"] is True
    assert "Due in" in res["countdown_text"]

def test_tomorrow_at_time():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("tomorrow at 3 PM", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert res["parsed_iso"].startswith("2026-10-23T15:00:00")
    assert res["is_date_only"] is False

def test_next_friday_parsing():
    # 2026-10-22 is Thursday
    ref = datetime.datetime(2026, 10, 22, 12, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("next Friday", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    # Next Friday from Thursday Oct 22 is Oct 23
    assert "2026-10-23" in res["parsed_iso"]

def test_business_days():
    # 2026-10-23 is Friday
    ref = datetime.datetime(2026, 10, 23, 9, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("in 2 business days", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    # Skipping Sat (24) and Sun (25): 1st biz day = Mon (26), 2nd biz day = Tue (27)
    assert "2026-10-27" in res["parsed_iso"]

def test_relative_hours_and_minutes():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("in 90 minutes", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert "2026-10-22T11:30:00" in res["parsed_iso"]
    assert res["is_date_only"] is False

def test_relative_two_weeks():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("in two weeks", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert "2026-11-05" in res["parsed_iso"]

def test_end_of_month():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("by the end of this month", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    # October has 31 days
    assert "2026-10-31T17:00:00" in res["parsed_iso"]

def test_year_boundary():
    ref = datetime.datetime(2026, 12, 30, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("in 3 days", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert "2027-01-02" in res["parsed_iso"]

def test_leap_year_boundary():
    # 2028 is a leap year (Feb has 29 days)
    ref = datetime.datetime(2028, 2, 27, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("in 2 days", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert "2028-02-29" in res["parsed_iso"]

def test_iso_date_and_time():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("2026-11-05 at 14:30", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "success"
    assert "2026-11-05T14:30:00" in res["parsed_iso"]
    assert res["is_date_only"] is False

def test_invalid_calendar_date():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("2026-02-31", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "invalid"
    assert "Invalid calendar date" in res["error_message"]

def test_ambiguous_phrase_requires_clarification():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("soon", reference_datetime=ref, timezone_str="UTC")
    assert res["status"] == "needs_clarification"
    assert res["clarification_question"] is not None

def test_overdue_and_completed_tasks():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    # Past date
    res_overdue = parse_natural_deadline("2026-10-20", reference_datetime=ref, timezone_str="UTC")
    assert res_overdue["status"] == "success"
    assert res_overdue["badge_status"] == "overdue"
    assert "Overdue by" in res_overdue["countdown_text"]

    # Same past date but task is completed
    res_completed = parse_natural_deadline("2026-10-20", reference_datetime=ref, timezone_str="UTC", is_completed=True)
    assert res_completed["badge_status"] == "completed"
    assert res_completed["countdown_text"] == "Completed"

def test_timezone_conversion():
    ref = datetime.datetime(2026, 10, 22, 10, 0, 0, tzinfo=datetime.timezone.utc)
    res = parse_natural_deadline("tomorrow at 3 PM", reference_datetime=ref, timezone_str="America/New_York")
    assert res["status"] == "success"
    assert "America/New_York" in res["timezone"]
