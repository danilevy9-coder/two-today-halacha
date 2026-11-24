package com.twotoday.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;
import static org.robolectric.Shadows.shadowOf;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.time.ZoneId;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.shadows.ShadowAlarmManager;

/** The reminder, the cards file and the updater, run against a simulated Android with the real content.txt. */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 34)
public class AppTest {
    Context c;
    AlarmManager alarms;
    NotificationManager notes;

    @Before public void setUp() {
        c = RuntimeEnvironment.getApplication();
        alarms = c.getSystemService(AlarmManager.class);
        notes = c.getSystemService(NotificationManager.class);
        ShadowAlarmManager.setCanScheduleExactAlarms(true);
    }

    void reminder(String time) { Reminder.prefs(c).edit().putString("reminder", time).commit(); }
    String text(int id) {
        Notification n = shadowOf(notes).getNotification(id);
        return n == null ? null : String.valueOf(n.extras.getCharSequence(Notification.EXTRA_TEXT));
    }

    @Test public void cardsLoad() {
        assertEquals(1534, Content.dates(c).size());
        assertEquals("Why do we light Chanukah candles?", Content.day(c, "2026-12-01")[4]);
        assertNull(Content.day(c, "2026-12-05")); // Shabbat
        assertTrue(Content.version(c) >= 1);
    }

    @Test public void settingAReminderSetsTheAlarm() {
        reminder("07:30");
        Reminder.schedule(c);
        ShadowAlarmManager.ScheduledAlarm alarm = shadowOf(alarms).peekNextScheduledAlarm();
        assertNotNull(alarm);
        assertEquals(Reminder.nextTime(c).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli(), alarm.getTriggerAtMs());
        assertTrue(Content.dates(c).contains(Reminder.nextTime(c).toLocalDate().toString())); // a day that has cards
    }

    @Test public void turningItOffClearsTheAlarm() {
        reminder("07:30"); Reminder.schedule(c);
        reminder(""); Reminder.schedule(c);
        assertNull(shadowOf(alarms).peekNextScheduledAlarm());
    }

    @Test public void theReminderShowsTheFirstQuestionOncePerDay() {
        Reminder.show(c, "2026-12-01");
        assertEquals("Why do we light Chanukah candles?", text(Reminder.NOTE));
        notes.cancelAll();
        Reminder.show(c, "2026-12-01"); // a second alarm on the same day
        assertNull(text(Reminder.NOTE));
    }

    @Test public void noReminderOnShabbatOrWhenDone() {
        Reminder.show(c, "2026-12-05");
        assertNull(text(Reminder.NOTE));
        Reminder.prefs(c).edit().putString("done", "2026-12-01,2026-12-02").commit();
        Reminder.show(c, "2026-12-02");
        assertNull(text(Reminder.NOTE));
    }

    @Test public void theTestReminderGoesThroughTheAlarm() {
        Reminder.test(c);
        ShadowAlarmManager.ScheduledAlarm alarm = shadowOf(alarms).peekNextScheduledAlarm();
        assertNotNull(alarm);
        assertTrue(alarm.getTriggerAtMs() - System.currentTimeMillis() <= 10_000);
        new Reminder().onReceive(c, new Intent(c, Reminder.class).setAction(Reminder.TEST)); // the alarm goes off
        assertNotNull(text(Reminder.TEST_NOTE));
    }

    @Test public void theAlarmGoingOffSetsTheNextOne() {
        reminder("07:30");
        new Reminder().onReceive(c, new Intent(c, Reminder.class).setAction(Reminder.FIRE));
        assertNotNull(shadowOf(alarms).peekNextScheduledAlarm());
    }

    @Test public void aDownloadedFileIsUsedOnlyWhenNewer() throws Exception {
        int shipped = Content.version(c);
        File f = new File(c.getFilesDir(), Content.FILE);
        try (OutputStream o = new FileOutputStream(f)) { o.write(("v\t" + shipped + "\n2026-12-01\tx\tx\tx\tOLD\tx\tx\tx\tx\tx\tx\tx\tx\n").getBytes()); }
        assertEquals("Why do we light Chanukah candles?", Content.day(c, "2026-12-01")[4]); // same version: the shipped file wins
        try (OutputStream o = new FileOutputStream(f)) { o.write(("v\t" + (shipped + 1) + "\n2026-12-01\tx\tx\tx\tCORRECTED\tx\tx\tx\tx\tx\tx\tx\tx\n").getBytes()); }
        assertEquals("CORRECTED", Content.day(c, "2026-12-01")[4]);
        f.delete();
    }

    @Test public void theUpdaterOnlyAcceptsACompleteFile() throws Exception {
        File good = new File(c.getCacheDir(), "good.txt"), cut = new File(c.getCacheDir(), "cut.txt");
        try (InputStream in = c.getAssets().open(Content.FILE); OutputStream a = new FileOutputStream(good); OutputStream b = new FileOutputStream(cut)) {
            byte[] all = new byte[in.available()];
            int n = 0; for (int r; n < all.length && (r = in.read(all, n, all.length - n)) > 0; ) n += r;
            a.write(all, 0, n);
            b.write(all, 0, n / 2 + 37); // a download that stopped half way, in the middle of a line
        }
        assertTrue(Updater.valid(good));
        assertFalse(Updater.valid(cut));
    }
}
