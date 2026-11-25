package com.twotoday.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Set;

/** The one daily reminder. Fires only on days that have cards, so never on Shabbat or Yom Tov. */
public class Reminder extends BroadcastReceiver {
    static final String FIRE = "com.twotoday.app.REMIND";
    static final String TEST = "com.twotoday.app.TEST";
    static final String CHANNEL = "reminders";
    static final String OPEN_TODAY = "com.twotoday.app.TODAY";
    static final int NOTE = 1, TEST_NOTE = 2, TEST_NOTE_2 = 3;
    /** Before Shabbat or Yom Tov a later reminder moves up to this time. */
    static final LocalTime EARLY = LocalTime.of(13, 0);

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("twotoday", Context.MODE_PRIVATE);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        boolean alarm = FIRE.equals(i.getAction()) || TEST.equals(i.getAction());
        if (alarm) prefs(c).edit().putString("alarmAt", LocalDateTime.now().withNano(0).toString()).apply(); // shown in Settings, to trace a missing reminder
        if (FIRE.equals(i.getAction())) show(c, LocalDate.now().toString());
        if (TEST.equals(i.getAction())) post(c, TEST_NOTE_2, "Test 2 of 2: the alarm works too. Your daily reminder will arrive like this.");
        schedule(c); // also after a restart, an app update or a clock change
        Widget.refresh(c);
    }

    /** Sets (or clears) the alarm for the next reminder. Safe to call any time. */
    static void schedule(Context c) {
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        PendingIntent fire = PendingIntent.getBroadcast(c, 0, new Intent(c, Reminder.class).setAction(FIRE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.cancel(fire);
        LocalDateTime when = nextTime(c);
        if (when == null) return;
        long at = when.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        if (exactAllowed(c)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire); // the phone may then deliver it up to an hour late
    }

    /** When the next reminder is due, or null when reminders are off or no cards lie ahead. */
    static LocalDateTime nextTime(Context c) {
        String time = prefs(c).getString("reminder", "");
        if (!time.matches("\\d\\d:\\d\\d")) return null;
        try {
            return next(Content.dates(c), LocalDateTime.now(), LocalTime.parse(time));
        } catch (Exception e) {
            return null; // not a real time
        }
    }

    /**
     * "Send a test reminder": one notification straight away, which shows that notifications are allowed,
     * and a second a minute later through the same alarm the daily reminder uses, which shows that the alarm arrives.
     */
    static void test(Context c) {
        post(c, TEST_NOTE, "Test 1 of 2: notifications work. A second test follows in about a minute.");
        PendingIntent fire = PendingIntent.getBroadcast(c, 1, new Intent(c, Reminder.class).setAction(TEST),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        long at = System.currentTimeMillis() + 60_000;
        if (exactAllowed(c)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
    }

    /** The notification manager, with the reminder channel in place. */
    static NotificationManager notes(Context c) {
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.deleteNotificationChannel("daily"); // the quieter channel of versions before 1.6
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, c.getString(R.string.channel), NotificationManager.IMPORTANCE_HIGH));
        return nm;
    }

    /** False when the phone will not show our notifications: switched off for the app, or for the reminder channel. */
    static boolean allowed(Context c) {
        NotificationManager nm = notes(c);
        return nm.areNotificationsEnabled() && nm.getNotificationChannel(CHANNEL).getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    /** On Android 14 and later the user has to allow "Alarms & reminders" for on-the-minute delivery. */
    static boolean exactAllowed(Context c) {
        return Build.VERSION.SDK_INT < 31 || c.getSystemService(AlarmManager.class).canScheduleExactAlarms();
    }

    /**
     * The next reminder after now: on a day with cards, at the chosen time;
     * when the following day has no cards (Shabbat or Yom Tov starts that evening), no later than EARLY.
     */
    static LocalDateTime next(Set<String> dates, LocalDateTime now, LocalTime time) {
        for (int k = 0; k < 40; k++) {
            LocalDate d = now.toLocalDate().plusDays(k);
            if (!dates.contains(d.toString())) continue;
            boolean eve = !dates.contains(d.plusDays(1).toString());
            LocalDateTime when = d.atTime(eve && time.isAfter(EARLY) ? EARLY : time);
            if (when.isAfter(now)) return when;
        }
        return null;
    }

    /** Shows that day's first question, unless the day has no cards, is already done, or was already announced. */
    static void show(Context c, String today) {
        String[] day = Content.day(c, today);
        SharedPreferences p = prefs(c);
        if (day == null || isDone(c, today) || today.equals(p.getString("shownOn", ""))) return; // at most one a day
        p.edit().putString("shownOn", today).apply();
        post(c, NOTE, day[4]);
    }

    /** Puts a notification on the screen; tapping it opens today's cards. */
    static void post(Context c, int id, String text) {
        notes(c).notify(id, new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(c.getColor(R.color.lime))
                .setContentTitle(c.getString(R.string.app_name))
                .setContentText(text)
                .setStyle(new Notification.BigTextStyle().bigText(text))
                .setContentIntent(openApp(c))
                .setAutoCancel(true)
                .build());
    }

    static boolean isDone(Context c, String date) {
        return ("," + prefs(c).getString("done", "") + ",").contains("," + date + ",");
    }

    static PendingIntent openApp(Context c) {
        return PendingIntent.getActivity(c, 0, new Intent(c, MainActivity.class).setAction(OPEN_TODAY).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
