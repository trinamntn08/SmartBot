package io.github.trinamntn08.smartbot;

import android.content.res.AssetManager;
import android.util.Log;
import android.webkit.WebResourceResponse;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;

final class NewsFeed {
    private final Map<String, URL> sources = new HashMap<>();
    private final Set<String> hosts = new HashSet<>();

    NewsFeed(AssetManager assets) {
        try (InputStream stream = assets.open("news-feeds.json");
                ByteArrayOutputStream body = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) body.write(buffer, 0, count);
            JSONObject catalog = new JSONObject(new String(body.toByteArray(), StandardCharsets.UTF_8));
            Iterator<String> ids = catalog.keys();
            while (ids.hasNext()) {
                String id = ids.next();
                URL url = new URL(catalog.getString(id));
                if (!"https".equals(url.getProtocol())) throw new IOException("Invalid feed scheme");
                sources.put(id, url);
                hosts.add(url.getAuthority());
            }
        } catch (IOException | JSONException error) {
            sources.clear();
            hosts.clear();
            Log.w("SmartBot", "Could not load the bundled news catalog", error);
        }
    }

    boolean isPublisher(String host) {
        return hosts.contains(host);
    }

    WebResourceResponse readPublisher(String id) {
        URL url = sources.get(id);
        return url == null ? error(403, "Forbidden") : read(url);
    }

    static WebResourceResponse readTuoitre(String section) {
        if (!section.matches("[a-z-]{1,32}")) return error(403, "Forbidden");
        try {
            return read(new URL("https://tuoitre.vn/rss/" + section + ".rss"));
        } catch (IOException error) {
            return error(502, "Feed unavailable");
        }
    }

    private static WebResourceResponse read(URL url) {
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("User-Agent", "SmartBot RSS Reader/1.0");
            if (connection.getResponseCode() != 200) throw new IOException();
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[8192];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (body.size() + count > 512 * 1024) throw new IOException();
                    body.write(buffer, 0, count);
                }
            }
            Map<String, String> headers = new HashMap<>();
            headers.put("X-Content-Type-Options", "nosniff");
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse("text/plain", "UTF-8", 200, "OK", headers,
                    new ByteArrayInputStream(body.toByteArray()));
        } catch (IOException error) {
            return error(502, "Feed unavailable");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static WebResourceResponse error(int status, String message) {
        return new WebResourceResponse("text/plain", "UTF-8", status, message,
                Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
