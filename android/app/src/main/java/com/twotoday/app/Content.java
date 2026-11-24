package com.twotoday.app;

import android.content.Context;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;

/**
 * The cards: content.txt, one line per day with 13 tab-separated fields
 * (date, Hebrew date, occasion, then topic, heading, answer, reference and link for each card).
 * The first line is "v<TAB>version". Shabbat and Yom Tov have no line.
 */
final class Content {
    static final String FILE = "content.txt";
    static final int FIELDS = 13;

    /** The newest copy: a downloaded correction if it is newer than the one shipped in the app. */
    static InputStream open(Context c) throws IOException {
        File f = new File(c.getFilesDir(), FILE);
        if (f.exists() && version(new FileInputStream(f)) > version(c.getAssets().open(FILE))) return new FileInputStream(f);
        return c.getAssets().open(FILE);
    }

    static int version(Context c) {
        try { return version(open(c)); } catch (IOException e) { return 0; }
    }

    static int version(InputStream in) {
        try (BufferedReader r = reader(in)) {
            String l = r.readLine();
            return l != null && l.startsWith("v\t") ? Integer.parseInt(l.substring(2).trim()) : 0;
        } catch (Exception e) {
            return 0;
        }
    }

    /** Every date that has cards, as "YYYY-MM-DD". */
    static Set<String> dates(Context c) {
        Set<String> out = new HashSet<>();
        try (BufferedReader r = reader(open(c))) {
            for (String l; (l = r.readLine()) != null; ) if (l.length() > 10 && l.charAt(10) == '\t') out.add(l.substring(0, 10));
        } catch (IOException ignored) { }
        return out;
    }

    /** The fields of one day, or null when that day has no cards. */
    static String[] day(Context c, String date) {
        try (BufferedReader r = reader(open(c))) {
            for (String l; (l = r.readLine()) != null; ) {
                if (!l.startsWith(date + "\t")) continue;
                String[] f = l.split("\t");
                return f.length == FIELDS ? f : null;
            }
        } catch (IOException ignored) { }
        return null;
    }

    static BufferedReader reader(InputStream in) {
        return new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8), 1 << 16);
    }
}
