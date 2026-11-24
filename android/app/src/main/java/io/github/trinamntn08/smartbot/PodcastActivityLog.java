package io.github.trinamntn08.smartbot;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.SystemClock;

import androidx.media3.common.MediaItem;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

final class PodcastActivityLog {
    private final Context context;
    private MediaItem playing;
    private long startedAt;

    PodcastActivityLog(Context context) {
        this.context = context;
    }

    void checkpoint(MediaItem next) {
        long now = SystemClock.elapsedRealtime();
        long elapsed = now - startedAt;
        if (playing != null && elapsed > 0) {
            long end = System.currentTimeMillis();
            long start = end - elapsed;
            ZoneId zone = ZoneId.systemDefault();
            while (start < end) {
                ZonedDateTime local = Instant.ofEpochMilli(start).atZone(zone);
                long midnight = local.toLocalDate().plusDays(1).atStartOfDay(zone).toInstant().toEpochMilli();
                long until = Math.min(end, midnight);
                save(local.toLocalDate().toString(), playing, until - start);
                start = until;
            }
        }
        startedAt = now;
        playing = next;
    }

    private void save(String date, MediaItem item, long elapsed) {
        JSONObject day = storedDay(context, date);
        JSONObject previous = day.optJSONObject(item.mediaId);
        try {
            day.put(item.mediaId, new JSONObject().put("category", "podcasts")
                    .put("topic", item.mediaMetadata.title)
                    .put("ms", elapsed + (previous == null ? 0 : previous.optLong("ms"))));
            storage(context).edit().putString(date, day.toString()).apply();
        } catch (JSONException ignored) {
            // A malformed episode must not interrupt playback.
        }
    }

    static JSONArray read(Context context, String date) {
        JSONObject day = storedDay(context, date);
        JSONArray entries = new JSONArray();
        day.keys().forEachRemaining(key -> entries.put(day.optJSONObject(key)));
        return entries;
    }

    private static JSONObject storedDay(Context context, String date) {
        try {
            return new JSONObject(storage(context).getString(date, "{}"));
        } catch (JSONException ignored) {
            return new JSONObject();
        }
    }

    private static SharedPreferences storage(Context context) {
        return context.getSharedPreferences("podcast-activity", Context.MODE_PRIVATE);
    }
}
