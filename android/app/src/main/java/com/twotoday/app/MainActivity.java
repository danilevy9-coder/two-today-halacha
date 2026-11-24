package com.twotoday.app;

import android.Manifest;
import android.app.Activity;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.Settings;
import android.view.WindowInsets;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

/** The whole screen is one WebView showing the bundled web app (index.html, app.js, styles.css). */
public class MainActivity extends Activity {
    /** A made-up address: every request under it is answered from the app's own files, never the network. */
    static final String HOME = "https://app.twotoday/";
    WebView web;

    @Override
    protected void onCreate(Bundle saved) {
        super.onCreate(saved);
        web = new WebView(this);
        web.setBackgroundColor(getColor(R.color.bg));
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(getColor(R.color.bg));
        root.addView(web);
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) { // keep the page clear of the status bar, navigation bar and keyboard
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets i = insets.getInsets(WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout() | WindowInsets.Type.ime());
                v.setPadding(i.left, i.top, i.right, i.bottom);
                return insets;
            });
        }

        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.addJavascriptInterface(new Bridge(), "Android");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith(HOME)) return null;
                String path = request.getUrl().getPath().substring(1);
                if (path.isEmpty()) path = "index.html";
                try {
                    InputStream in = path.equals(Content.FILE) ? Content.open(MainActivity.this) : getAssets().open(path);
                    return new WebResourceResponse(mime(path), "utf-8", in);
                } catch (IOException e) {
                    return new WebResourceResponse("text/plain", "utf-8", 404, "Not found", new HashMap<>(), new ByteArrayInputStream(new byte[0]));
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame() || request.getUrl().toString().startsWith(HOME)) return false; // hidden frames load in place
                open(new Intent(Intent.ACTION_VIEW, request.getUrl())); // sources and downloads open in the browser
                return true;
            }
        });
        web.loadUrl(HOME);
    }

    static String mime(String path) {
        return path.endsWith(".html") ? "text/html" : path.endsWith(".js") ? "text/javascript"
                : path.endsWith(".css") ? "text/css" : path.endsWith(".svg") ? "image/svg+xml" : "text/plain";
    }

    void open(Intent intent) {
        try { startActivity(intent); } catch (Exception ignored) { }
    }

    @Override
    protected void onResume() {
        super.onResume();
        getSystemService(NotificationManager.class).cancel(Reminder.NOTE); // opening the app answers the reminder
        Reminder.schedule(this);
        Widget.refresh(this);
        Updater.check(this);
        web.evaluateJavascript("window.onAppResume && onAppResume()", null);
    }

    @Override
    protected void onNewIntent(Intent intent) { // the reminder or the widget was tapped while the app was open
        super.onNewIntent(intent);
        if (Reminder.OPEN_TODAY.equals(intent.getAction())) web.evaluateJavascript("if (location.hash) location.hash = ''", null);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    /** What the page can ask the phone to do. Called from app.js as Android.xxx(). */
    class Bridge {
        @JavascriptInterface
        public String get(String key) {
            return Reminder.prefs(MainActivity.this).getString(key, "");
        }

        @JavascriptInterface
        public void set(String key, String value) {
            Reminder.prefs(MainActivity.this).edit().putString(key, value).apply();
            if (key.equals("done")) Widget.refresh(MainActivity.this);
        }

        /** "HH:MM" turns the daily reminder on at that time; "" turns it off. */
        @JavascriptInterface
        public void setReminder(String time) {
            set("reminder", time);
            runOnUiThread(() -> {
                if (!time.isEmpty() && Build.VERSION.SDK_INT >= 33
                        && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
                }
                Reminder.schedule(MainActivity.this);
            });
        }

        @JavascriptInterface
        public boolean notificationsAllowed() {
            return getSystemService(NotificationManager.class).areNotificationsEnabled();
        }

        @JavascriptInterface
        public void notificationSettings() {
            open(new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName()));
        }

        @JavascriptInterface
        public boolean exactAllowed() {
            return Reminder.exactAllowed(MainActivity.this);
        }

        /** Opens the "Alarms & reminders" setting for this app (Android 12 and later). */
        @JavascriptInterface
        public void allowExact() {
            if (Build.VERSION.SDK_INT >= 31) open(new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:" + getPackageName())));
        }

        @JavascriptInterface
        public void share(String text) {
            Intent send = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text);
            open(Intent.createChooser(send, null));
        }

        /** Opens the phone's battery settings, where the user can stop it from putting Two Today to sleep. */
        @JavascriptInterface
        public void battery() {
            try {
                startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));
            } catch (Exception e) {
                open(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getPackageName())));
            }
        }

        @JavascriptInterface
        public int version() {
            return BuildConfig.VERSION_CODE;
        }
    }
}
