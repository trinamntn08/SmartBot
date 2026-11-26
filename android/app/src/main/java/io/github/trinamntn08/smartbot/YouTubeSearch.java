package io.github.trinamntn08.smartbot;

import android.content.Context;
import android.content.SharedPreferences;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.List;

import okhttp3.HttpUrl;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

final class YouTubeSearch {
    private static final String KEY = "apiKey";
    private static final int MAX_RESPONSE = 128 * 1024;
    private static final HttpUrl HOSTED = hostedOrigin(BuildConfig.YOUTUBE_API);
    private final SharedPreferences settings;

    YouTubeSearch(Context context) {
        settings = context.getSharedPreferences("youtube-search", Context.MODE_PRIVATE);
    }

    private static HttpUrl hostedOrigin(String setting) {
        HttpUrl url = HttpUrl.parse(setting);
        return url != null && url.isHttps() && url.encodedPath().equals("/") && url.query() == null
                && url.fragment() == null && url.username().isEmpty() && url.password().isEmpty() ? url : null;
    }

    WebResourceResponse read(String action, WebResourceRequest request) {
        boolean allowed = "GET".equals(request.getMethod()) && request.getRequestHeaders().entrySet().stream()
                .anyMatch(header -> "X-SmartBot-YouTube".equalsIgnoreCase(header.getKey())
                        && "music".equals(header.getValue()));
        if (!allowed) return error(403, "Open YouTube search inside SmartBot.");
        String key = HOSTED == null ? settings.getString(KEY, "") : "";
        if (action.isEmpty()) {
            if (HOSTED != null) return hosted("status", null, null);
            return json(200, key.isEmpty() ? "{\"configured\":false}" : "{\"configured\":true}");
        }
        boolean chart = "chart".equals(action);
        List<String> queries = request.getUrl().getQueryParameters(chart ? "region" : "q");
        String query = queries.size() == 1 ? queries.get(0).trim() : "";
        if (chart && !query.matches("FR|VN|US")) return error(400, "Choose an available YouTube chart.");
        if (!chart && (query.isEmpty() || query.length() > 120)) return error(400, "Enter a song or artist name.");
        if (HOSTED != null) return hosted(action, chart ? "region" : "q", query);
        if (key.isEmpty()) return error(503, "Live YouTube browsing is unavailable.");
        return youtubeVideos(query, key, chart);
    }

    private static WebResourceResponse hosted(String action, String parameter, String value) {
        HttpUrl.Builder target = HOSTED.newBuilder().addPathSegment("api").addPathSegment("youtube").addPathSegment(action);
        if (parameter != null) target.addQueryParameter(parameter, value);
        return request(target.build().url(), null, action);
    }

    private static WebResourceResponse youtubeVideos(String query, String key, boolean chart) {
        try {
            String resource = chart
                    ? "videos?part=snippet,status&chart=mostPopular&videoCategoryId=10&maxResults=16"
                    + "&fields=items(id,snippet(title,channelTitle,thumbnails(medium/url)),status/embeddable)&regionCode=" + query
                    : "search?part=snippet&type=video"
                    + "&videoCategoryId=10&videoEmbeddable=true&videoSyndicated=true&maxResults=8"
                    + "&fields=items(id/videoId,snippet(title,channelTitle))&q="
                    + URLEncoder.encode(query, StandardCharsets.UTF_8.name());
            return request(new URL("https://www.googleapis.com/youtube/v3/" + resource), key, chart ? "chart" : "search");
        } catch (IOException failure) {
            return error(502, "YouTube could not be reached. Try again.");
        }
    }

    private static WebResourceResponse request(URL url, String key, String action) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setInstanceFollowRedirects(false);
            if (key == null) connection.setRequestProperty("X-SmartBot-YouTube", "music");
            else connection.setRequestProperty("X-Goog-Api-Key", key);
            int status = connection.getResponseCode();
            InputStream stream = status == 200 ? connection.getInputStream() : connection.getErrorStream();
            JSONObject data = stream == null ? new JSONObject() : readObject(stream);
            if (status == 200) {
                if ("status".equals(action)) {
                    return json(200, data.optBoolean("configured") ? "{\"configured\":true}" : "{\"configured\":false}");
                }
                if (data.optJSONArray("items") != null) return json(200, data.toString());
            }
            if (status == 429 || quotaError(data)) {
                return error(429, "YouTube's request limit was reached. Try again later.");
            }
        } catch (IOException | JSONException failure) {
            return error(502, "YouTube could not be reached. Try again.");
        } finally {
            if (connection != null) connection.disconnect();
        }
        return error(502, "YouTube is temporarily unavailable.");
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
