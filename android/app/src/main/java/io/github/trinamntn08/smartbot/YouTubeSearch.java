package io.github.trinamntn08.smartbot;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import androidx.webkit.JavaScriptReplyProxy;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class YouTubeSearch {
    private static final String KEY = "apiKey";
    private static final int MAX_RESPONSE = 128 * 1024;
    private final SharedPreferences settings;

    YouTubeSearch(Context context) {
        settings = context.getSharedPreferences("youtube-search", Context.MODE_PRIVATE);
    }

    void saveKey(String value, JavaScriptReplyProxy reply) {
        if (value == null || !value.isEmpty() && !value.matches("[A-Za-z0-9_-]{20,128}")) {
            reply.postMessage(errorJson("Enter a valid YouTube Data API key."));
            return;
        }
        SharedPreferences.Editor editor = settings.edit();
        if (value.isEmpty()) editor.remove(KEY);
        else editor.putString(KEY, value);
        editor.apply();
        reply.postMessage(value.isEmpty() ? "{\"configured\":false}" : "{\"configured\":true}");
    }

    WebResourceResponse read(boolean search, WebResourceRequest request) {
        boolean allowed = "GET".equals(request.getMethod()) && request.getRequestHeaders().entrySet().stream()
                .anyMatch(header -> "X-SmartBot-YouTube".equalsIgnoreCase(header.getKey())
                        && "music".equals(header.getValue()));
        if (!allowed) return error(403, "Open YouTube search inside SmartBot.");
        String key = settings.getString(KEY, "");
        if (!search) return json(200, key.isEmpty() ? "{\"configured\":false}" : "{\"configured\":true}");
        Uri uri = request.getUrl();
        java.util.List<String> queries = uri.getQueryParameters("q");
        String query = queries.size() == 1 ? queries.get(0).trim() : "";
        if (query.isEmpty() || query.length() > 120) return error(400, "Enter a song or artist name.");
        if (key.isEmpty()) return error(503, "Configure a YouTube Data API key to search.");
        return search(query, key);
    }

    private static WebResourceResponse search(String query, String key) {
        HttpURLConnection connection = null;
        try {
            String endpoint = "https://www.googleapis.com/youtube/v3/search?part=snippet&type=video"
                    + "&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true&maxResults=8"
                    + "&fields=items(id/videoId,snippet(title,channelTitle))&q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8.name());
            connection = (HttpURLConnection) new URL(endpoint).openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setInstanceFollowRedirects(false);
            connection.setRequestProperty("X-Goog-Api-Key", key);
            int status = connection.getResponseCode();
            InputStream stream = status == 200 ? connection.getInputStream() : connection.getErrorStream();
            JSONObject data = stream == null ? new JSONObject() : readObject(stream);
            if (status == 200 && data.optJSONArray("items") != null) return json(200, data.toString());
            if (status == 429 || quotaError(data)) return error(429, "YouTube's search limit was reached. Try again later.");
            if (status == 400 || status == 401 || status == 403) {
                return error(403, "Check your API key and enable YouTube Data API v3 for its project.");
            }
        } catch (IOException | JSONException failure) {
            return error(502, "YouTube search could not be reached. Try again.");
        } finally {
            if (connection != null) connection.disconnect();
        }
        return error(502, "YouTube search is temporarily unavailable.");
    }

    private static JSONObject readObject(InputStream stream) throws IOException, JSONException {
        try (InputStream input = stream; ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            for (int size; (size = input.read(buffer)) != -1; ) {
                if (output.size() + size > MAX_RESPONSE) throw new IOException("YouTube response too large");
                output.write(buffer, 0, size);
            }
            return new JSONObject(output.toString(StandardCharsets.UTF_8.name()));
        }
    }

    private static boolean quotaError(JSONObject data) {
        JSONObject error = data.optJSONObject("error");
        JSONArray details = error == null ? null : error.optJSONArray("errors");
        if (details == null) return false;
        for (int i = 0; i < details.length(); i++) {
            JSONObject detail = details.optJSONObject(i);
            String reason = detail == null ? "" : detail.optString("reason");
            if ("quotaExceeded".equals(reason) || "dailyLimitExceeded".equals(reason)
                    || "rateLimitExceeded".equals(reason)) return true;
        }
        return false;
    }

    private static WebResourceResponse error(int status, String message) {
        return json(status, errorJson(message));
    }

    private static String errorJson(String message) {
        return "{\"error\":" + JSONObject.quote(message) + "}";
    }

    private static WebResourceResponse json(int status, String body) {
        return new WebResourceResponse("application/json", "UTF-8", status, status == 200 ? "OK" : "Error",
                Collections.singletonMap("Cache-Control", "no-store"),
                new ByteArrayInputStream(body.getBytes(StandardCharsets.UTF_8)));
    }
}
