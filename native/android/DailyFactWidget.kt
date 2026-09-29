package com.dailyhow.app.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Home-screen widget that shows only today's fact title.
 * Data source: GET {AppConfig.APP_ORIGIN}/api/public/today-title
 * (AppConfig.kt is generated from APP_URL in .env by `npm run config:sync`.)
 */
class DailyFactWidget : AppWidgetProvider() {

    companion object {
        private const val ENDPOINT = "${AppConfig.APP_ORIGIN}/api/public/today-title"
    }

    override fun onUpdate(
        context: Context,
        appWidgetManager: AppWidgetManager,
        appWidgetIds: IntArray
    ) {
        appWidgetIds.forEach { widgetId ->
            CoroutineScope(Dispatchers.IO).launch {
                val title = fetchTitle() ?: "Today's fact is on its way…"
                withContext(Dispatchers.Main) {
                    render(context, appWidgetManager, widgetId, title)
                }
            }
        }
    }

    private fun render(
        context: Context,
        manager: AppWidgetManager,
        widgetId: Int,
        title: String
    ) {
        val views = RemoteViews(context.packageName, R.layout.daily_fact_widget)
        views.setTextViewText(R.id.widget_title, title)

        val openApp = Intent(Intent.ACTION_VIEW, Uri.parse(AppConfig.APP_ORIGIN))
        val pending = PendingIntent.getActivity(
            context,
            0,
            openApp,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
        views.setOnClickPendingIntent(R.id.widget_root, pending)

        manager.updateAppWidget(widgetId, views)
    }

    private fun fetchTitle(): String? = try {
        val connection = (URL(ENDPOINT).openConnection() as HttpURLConnection).apply {
            requestMethod = "GET"
            connectTimeout = 10_000
            readTimeout = 10_000
        }
        connection.inputStream.bufferedReader().use { reader ->
            val json = JSONObject(reader.readText())
            if (json.isNull("title")) null else json.getString("title")
        }
    } catch (error: Exception) {
        null
    }
}
