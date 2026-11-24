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
    static final String CHANNEL = "daily";
    static final String OPEN_TODAY = "com.twotoday.app.TODAY";
    static final int NOTE = 1;
    /** Before Shabbat or Yom Tov a later reminder moves up to this time. */
    static final LocalTime EARLY = LocalTime.of(13, 0);

    static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences("twotoday", Context.MODE_PRIVATE);
    }

    @Override
    public void onReceive(Context c, Intent i) {
        if (FIRE.equals(i.getAction())) show(c);
        schedule(c); // also after a restart, an app update or a clock change
        Widget.refresh(c);
    }

    /** Sets (or clears) the alarm for the next reminder. Safe to call any time. */
    static void schedule(Context c) {
        AlarmManager alarms = c.getSystemService(AlarmManager.class);
        PendingIntent fire = PendingIntent.getBroadcast(c, 0, new Intent(c, Reminder.class).setAction(FIRE),
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        alarms.cancel(fire);
        String time = prefs(c).getString("reminder", "");
        if (!time.matches("\\d\\d:\\d\\d")) return;
        LocalDateTime when;
        try {
            when = next(Content.dates(c), LocalDateTime.now(), LocalTime.parse(time));
        } catch (Exception e) {
            return; // not a real time
        }
        if (when == null) return;
        long at = when.atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        if (exactAllowed(c)) alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire);
        else alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, fire); // the phone may then deliver it up to an hour late
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

    /** Shows today's first question, unless today has no cards or is already done. */
    static void show(Context c) {
        String today = LocalDate.now().toString();
        String[] day = Content.day(c, today);
        SharedPreferences p = prefs(c);
        if (day == null || isDone(c, today) || today.equals(p.getString("shownOn", ""))) return; // at most one a day
        p.edit().putString("shownOn", today).apply();
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        nm.createNotificationChannel(new NotificationChannel(CHANNEL, c.getString(R.string.channel), NotificationManager.IMPORTANCE_DEFAULT));
        nm.notify(NOTE, new Notification.Builder(c, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat)
                .setColor(c.getColor(R.color.lime))
                .setContentTitle(c.getString(R.string.app_name))
                .setContentText(day[4])
                .setStyle(new Notification.BigTextStyle().bigText(day[4]))
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
