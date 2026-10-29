package com.dailyhow.app.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

import com.dailyhow.app.R;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;

/**
 * Home-screen widget showing today's explainer title. Tapping it opens the app.
 * Data: GET {app_origin}/api/public/today-title (app_origin comes from APP_URL in .env,
 * written to res/values/app_config.xml by `npm run config:sync`).
 */
public class DailyFactWidget extends AppWidgetProvider {

    static final String PREFS = "daily_how_widget";
    static final String KEY_TITLE = "title";
    static final String KEY_DATE = "date";
    static final String KEY_HOOK = "hook";
    static final String KEY_STREAK = "streak";
    static final String KEY_STREAK_DATE = "streak_date";

    private static final String ACTION_DAILY = "com.dailyhow.app.widget.DAILY_REFRESH";

    /** Schedule the next refresh for 00:05 UTC (when the new explainer goes live). Inexact: no permission needed. */
    private static void scheduleDaily(Context context) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        Calendar next = Calendar.getInstance(TimeZone.getTimeZone("UTC"));
        next.set(Calendar.HOUR_OF_DAY, 0);
        next.set(Calendar.MINUTE, 5);
        next.set(Calendar.SECOND, 0);
        next.set(Calendar.MILLISECOND, 0);
        if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_MONTH, 1);
        Intent intent = new Intent(context, DailyFactWidget.class).setAction(ACTION_DAILY);
        PendingIntent pi = PendingIntent.getBroadcast(
                context, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, next.getTimeInMillis(), pi);
    }

    @Override
    public void onEnabled(Context context) {
        scheduleDaily(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (ACTION_DAILY.equals(intent.getAction())) {
            scheduleDaily(context);
            AppWidgetManager manager = AppWidgetManager.getInstance(context);
            int[] ids = manager.getAppWidgetIds(new ComponentName(context, DailyFactWidget.class));
            if (ids != null && ids.length > 0) onUpdate(context, manager, ids);
            return;
        }
        super.onReceive(context, intent);
    }

    /** Re-render all widgets from cached data (no network). */
    public static void renderFromCache(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, DailyFactWidget.class));
        if (ids == null || ids.length == 0) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String title = prefs.getString(KEY_TITLE, null);
        if (title != null && todayUtc().equals(prefs.getString(KEY_DATE, null))) {
            renderAll(context, manager, ids, title, prefs.getString(KEY_HOOK, null));
        } else {
            // Nothing fresh cached: run a full update (fetches the title) instead of showing "loading".
            Intent update = new Intent(context, DailyFactWidget.class)
                    .setAction(AppWidgetManager.ACTION_APPWIDGET_UPDATE)
                    .putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids);
            context.sendBroadcast(update);
        }
    }

    /** Streak text like "🔥 5", or null when unknown/stale (last synced before yesterday). */
    private static String streakText(Context context) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int streak = prefs.getInt(KEY_STREAK, 0);
        String date = prefs.getString(KEY_STREAK_DATE, null);
        if (streak <= 0 || date == null) return null;
        long now = System.currentTimeMillis();
        String today = todayUtc();
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        String yesterday = f.format(new Date(now - 24L * 60 * 60 * 1000));
        if (!date.equals(today) && !date.equals(yesterday)) return null;
        return "\uD83D\uDD25 " + streak;
    }

    @Override
    public void onUpdate(final Context context, final AppWidgetManager manager, final int[] ids) {
        scheduleDaily(context); // self-heals after reboot / app update
        final String origin = context.getString(R.string.app_origin);
        final SharedPreferences prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        final String today = todayUtc();

        // Show something immediately: today's cached title, otherwise a placeholder.
        String cachedTitle = prefs.getString(KEY_TITLE, null);
        String cachedDate = prefs.getString(KEY_DATE, null);
        String immediate = cachedTitle != null
                ? cachedTitle
                : context.getString(R.string.widget_loading);
        renderAll(context, manager, ids, immediate, cachedTitle != null ? prefs.getString(KEY_HOOK, null) : null);

        // Fetch the latest title off the main thread; goAsync keeps the process alive meanwhile.
        final PendingResult pending = goAsync();
        new Thread(new Runnable() {
            @Override
            public void run() {
                try {
                    String[] fresh = fetchTitle(origin);
                    String text;
                    String hook = null;
                    if (fresh != null) {
                        hook = fresh[2];
                        prefs.edit().putString(KEY_TITLE, fresh[0]).putString(KEY_DATE, fresh[1]).putString(KEY_HOOK, fresh[2]).apply();
                        text = fresh[0];
                    } else {
                        String title = prefs.getString(KEY_TITLE, null);
                        // Offline or not published yet: keep the last known explainer rather than a prompt.
                        text = title != null ? title : context.getString(R.string.widget_fallback);
                        if (title != null) hook = prefs.getString(KEY_HOOK, null);
                    }
                    renderAll(context, manager, ids, text, hook);
                } catch (Exception ignored) {
                    // keep whatever is currently shown
                } finally {
                    pending.finish();
                }
            }
        }).start();
    }

    private static void renderAll(Context context, AppWidgetManager manager, int[] ids, String title, String hook) {
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.daily_fact_widget);
            views.setTextViewText(R.id.widget_title, title);
            if (hook != null && hook.length() > 0) {
                views.setTextViewText(R.id.widget_hook, hook);
                views.setViewVisibility(R.id.widget_hook, android.view.View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_hook, android.view.View.GONE);
            }
            String streak = streakText(context);
            if (streak != null) {
                views.setTextViewText(R.id.widget_streak, streak);
                views.setViewVisibility(R.id.widget_streak, android.view.View.VISIBLE);
            } else {
                views.setViewVisibility(R.id.widget_streak, android.view.View.GONE);
            }

            // Tap = open the Daily How app.
            Intent launch = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (launch != null) {
                PendingIntent open = PendingIntent.getActivity(
                        context, 0, launch, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
                views.setOnClickPendingIntent(R.id.widget_root, open);
            }
            manager.updateAppWidget(id, views);
        }
    }

    /** Returns {title, date} or null when unavailable (offline, not published yet, error). */
    private static String[] fetchTitle(String origin) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(origin + "/api/public/today-title").openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(10000);
            if (connection.getResponseCode() != 200) return null;
            StringBuilder body = new StringBuilder();
            BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()));
            try {
                String line;
                while ((line = reader.readLine()) != null) body.append(line);
            } finally {
                reader.close();
            }
            JSONObject json = new JSONObject(body.toString());
            if (json.isNull("title")) return null;
            String date = json.optString("date", todayUtc());
            return new String[] { json.getString("title"), date, json.isNull("hook") ? "" : json.optString("hook", "") };
        } catch (Exception error) {
            return null;
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String todayUtc() {
        SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        format.setTimeZone(TimeZone.getTimeZone("UTC"));
        return format.format(new Date());
    }
}
