package com.twotoday.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.widget.RemoteViews;
import java.time.DayOfWeek;
import java.time.LocalDate;

/** Home-screen widget: today's first question. Tapping it opens the app. */
public class Widget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context c, AppWidgetManager m, int[] ids) {
        draw(c, m, ids);
    }

    static void refresh(Context c) {
        AppWidgetManager m = AppWidgetManager.getInstance(c);
        draw(c, m, m.getAppWidgetIds(new ComponentName(c, Widget.class)));
    }

    static void draw(Context c, AppWidgetManager m, int[] ids) {
        if (ids.length == 0) return;
        LocalDate today = LocalDate.now();
        String[] day = Content.day(c, today.toString());
        String top, text;
        if (day != null) {
            top = Reminder.isDone(c, today.toString()) ? "Done for today ✓" : "Today · " + day[3];
            text = day[4];
        } else {
            top = c.getString(R.string.app_name);
            text = today.getDayOfWeek() == DayOfWeek.SATURDAY ? "Shabbat shalom." : "No cards today.";
        }
        RemoteViews v = new RemoteViews(c.getPackageName(), R.layout.widget);
        v.setTextViewText(R.id.w_top, top);
        v.setTextViewText(R.id.w_q, text);
        v.setOnClickPendingIntent(R.id.w_root, Reminder.openApp(c));
        m.updateAppWidget(ids, v);
    }
}
