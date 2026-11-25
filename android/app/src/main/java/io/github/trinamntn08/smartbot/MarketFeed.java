package io.github.trinamntn08.smartbot;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class MarketFeed {
    private static final int MAX_RESPONSE = 128 * 1024;
    private static final String ENDPOINT = "https://www.dolthub.com/api/v2/databases/post-no-preference/stocks/sql";

    static WebResourceResponse read(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return response(403, "Forbidden", new byte[0]);
        List<String> symbols = request.getUrl().getQueryParameters("symbol");
        if (symbols.size() != 1 || !symbols.get(0).matches("[A-Z]{1,5}")) {
            return response(400, "Invalid symbol", new byte[0]);
        }

        LocalDate start = LocalDate.now(ZoneOffset.UTC).minusDays(400);
        String query = "SELECT date, close FROM ohlcv WHERE act_symbol = '"
                + symbols.get(0) + "' AND date >= '" + start + "' ORDER BY date DESC LIMIT 280";
        HttpURLConnection connection = null;
        try {
            URL url = new URL(Uri.parse(ENDPOINT).buildUpon()
                    .appendQueryParameter("ref", "master")
                    .appendQueryParameter("timeout_ms", "6000")
                    .appendQueryParameter("q", query)
                    .build().toString());
            connection = (HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(8000);
            connection.setReadTimeout(8000);
            connection.setRequestProperty("Accept", "application/json");
            if (connection.getResponseCode() != 200) throw new IOException();
            ByteArrayOutputStream body = new ByteArrayOutputStream();
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (body.size() + count > MAX_RESPONSE) throw new IOException();
                    body.write(buffer, 0, count);
                }
            }
            return response(200, "OK", body.toByteArray());
        } catch (IOException error) {
            return response(502, "Daily prices unavailable", new byte[0]);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static WebResourceResponse response(int status, String reason, byte[] body) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("X-Content-Type-Options", "nosniff");
        return new WebResourceResponse("application/json", "UTF-8", status, reason, headers,
                new ByteArrayInputStream(body));
    }
}
