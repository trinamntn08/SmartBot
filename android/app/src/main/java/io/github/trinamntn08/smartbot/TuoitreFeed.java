package io.github.trinamntn08.smartbot;

import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Collections;

final class TuoitreFeed {
    private TuoitreFeed() { }

    static WebResourceResponse read(String section) {
        HttpURLConnection connection = null;
        try {
            if (!section.matches("[a-z-]{1,32}")) throw new IOException();
            URL url = new URL("https://tuoitre.vn/rss/" + section + ".rss");
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
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
            return new WebResourceResponse("text/plain", "UTF-8", 200, "OK",
                    Collections.singletonMap("X-Content-Type-Options", "nosniff"),
                    new ByteArrayInputStream(body.toByteArray()));
        } catch (IOException error) {
            return new WebResourceResponse("text/plain", "UTF-8", 502, "Feed unavailable",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        } finally {
            if (connection != null) connection.disconnect();
        }
    }
}
