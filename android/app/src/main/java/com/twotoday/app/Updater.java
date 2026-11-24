package com.twotoday.app;

import android.content.Context;
import android.content.SharedPreferences;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.function.Consumer;

/**
 * Once a day when online, and whenever asked from Settings: fetches corrected cards and the number of the newest app version.
 * A downloaded content file replaces the old one only if it is complete and newer.
 */
final class Updater {
    static final String SITE = "https://two-today-halacha.vercel.app/";
    static final long DAY = 24L * 60 * 60 * 1000;
    static volatile boolean busy; // one check at a time, so two downloads never share the temp file

    /** The quiet daily check, made when the app opens. */
    static void check(Context context) {
        if (System.currentTimeMillis() - Reminder.prefs(context).getLong("checkedAt", 0) >= DAY) run(context, null);
    }

    /**
     * Checks now, in the background. `done` (may be null) is told the outcome:
     * "cards" when newer cards were downloaded, "same" when there was nothing new, "error" when the site could not be reached.
     */
    static void run(Context context, Consumer<String> done) {
        Context c = context.getApplicationContext();
        SharedPreferences p = Reminder.prefs(c);
        if (busy) { if (done != null) done.accept("same"); return; }
        busy = true;
        new Thread(() -> {
            String outcome = "error";
            try {
                String latest;
                try (BufferedReader r = Content.reader(get("version.txt", null).getInputStream())) { latest = r.readLine(); }
                if (latest != null && latest.trim().matches("\\d+")) p.edit().putString("latestApp", latest.trim()).apply();
                outcome = content(c, p) ? "cards" : "same";
                p.edit().putLong("checkedAt", System.currentTimeMillis()).apply();
            } catch (Exception ignored) {
                // offline or the site is down: try again next time the app opens
            } finally {
                busy = false;
            }
            if (done != null) done.accept(outcome);
        }).start();
    }

    /** Downloads content.txt if the site has a different one; true when a newer, complete file was put in place. */
    static boolean content(Context c, SharedPreferences p) throws Exception {
        HttpURLConnection h = get(Content.FILE, p.getString("etag", null));
        if (h.getResponseCode() != 200) return false; // 304: nothing new
        File tmp = new File(c.getFilesDir(), Content.FILE + ".tmp");
        try (InputStream in = h.getInputStream(); OutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[1 << 16];
            for (int n; (n = in.read(buf)) > 0; ) out.write(buf, 0, n);
        }
        boolean newer = valid(tmp) && Content.version(new FileInputStream(tmp)) > Content.version(c);
        if (newer) newer = tmp.renameTo(new File(c.getFilesDir(), Content.FILE));
        else tmp.delete();
        if (newer) {
            Reminder.schedule(c);
            Widget.refresh(c);
        }
        p.edit().putString("etag", h.getHeaderField("ETag")).apply();
        return newer;
    }

    /** A usable file has a version line and at least 1,000 full day lines, nothing else. */
    static boolean valid(File f) {
        int days = 0;
        try (BufferedReader r = Content.reader(new FileInputStream(f))) {
            String l = r.readLine();
            if (l == null || !l.startsWith("v\t")) return false;
            while ((l = r.readLine()) != null) {
                if (l.isEmpty()) continue;
                if (l.split("\t").length != Content.FIELDS || !l.matches("\\d{4}-\\d\\d-\\d\\d\t.*")) return false;
                days++;
            }
        } catch (Exception e) {
            return false;
        }
        return days >= 1000;
    }

    static HttpURLConnection get(String path, String etag) throws Exception {
        HttpURLConnection h = (HttpURLConnection) new URL(SITE + path).openConnection();
        h.setConnectTimeout(15000);
        h.setReadTimeout(30000);
        if (etag != null) h.setRequestProperty("If-None-Match", etag);
        return h;
    }
}
