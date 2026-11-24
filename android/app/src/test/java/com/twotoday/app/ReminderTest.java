package com.twotoday.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertNull;

import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import org.junit.Test;

public class ReminderTest {
    // Thu 3, Fri 4, (Shabbat 5 missing), Sun 6, Mon 7 Dec 2026
    final Set<String> dates = new HashSet<>(Arrays.asList("2026-12-03", "2026-12-04", "2026-12-06", "2026-12-07"));

    static LocalDateTime at(String s) { return LocalDateTime.parse(s); }

    @Test public void laterToday() {
        assertEquals(at("2026-12-03T20:00"), Reminder.next(dates, at("2026-12-03T08:00"), LocalTime.of(20, 0)));
    }
    @Test public void tomorrowOnceTodayHasPassed() {
        assertEquals(at("2026-12-04T07:30"), Reminder.next(dates, at("2026-12-03T07:30"), LocalTime.of(7, 30)));
    }
    @Test public void fridayEveningMovesToOne() {
        assertEquals(at("2026-12-04T13:00"), Reminder.next(dates, at("2026-12-03T21:00"), LocalTime.of(20, 0)));
    }
    @Test public void fridayMorningStays() {
        assertEquals(at("2026-12-04T07:30"), Reminder.next(dates, at("2026-12-03T21:00"), LocalTime.of(7, 30)));
    }
    @Test public void nothingOnShabbat() {
        assertEquals(at("2026-12-06T20:00"), Reminder.next(dates, at("2026-12-04T13:00"), LocalTime.of(20, 0)));
        assertEquals(at("2026-12-06T07:30"), Reminder.next(dates, at("2026-12-05T09:00"), LocalTime.of(7, 30)));
    }
    @Test public void noneWhenNoCardsAhead() {
        assertNull(Reminder.next(dates, at("2026-12-08T09:00"), LocalTime.of(7, 30)));
    }
}
