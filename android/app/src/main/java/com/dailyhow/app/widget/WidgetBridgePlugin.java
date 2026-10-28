package com.dailyhow.app.widget;

import android.content.Context;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Lets the web app hand the user's streak to the home-screen widget. */
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {

    @PluginMethod
    public void setStreak(PluginCall call) {
        Integer streak = call.getInt("streak");
        String date = call.getString("date");
        if (streak == null || date == null) {
            call.reject("streak and date are required");
            return;
        }
        Context ctx = getContext();
        ctx.getSharedPreferences(DailyFactWidget.PREFS, Context.MODE_PRIVATE).edit()
                .putInt(DailyFactWidget.KEY_STREAK, streak)
                .putString(DailyFactWidget.KEY_STREAK_DATE, date)
                .apply();
        DailyFactWidget.renderFromCache(ctx);
        call.resolve();
    }

    @PluginMethod
    public void clearStreak(PluginCall call) {
        Context ctx = getContext();
        ctx.getSharedPreferences(DailyFactWidget.PREFS, Context.MODE_PRIVATE).edit()
                .remove(DailyFactWidget.KEY_STREAK)
                .remove(DailyFactWidget.KEY_STREAK_DATE)
                .apply();
        DailyFactWidget.renderFromCache(ctx);
        call.resolve();
    }
}
