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
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class MarketFeed {
    private static final int MAX_RESPONSE = 128 * 1024;
    private static final String ENDPOINT = "https://www.dolthub.com/api/v1alpha1/post-no-preference/stocks";

    static WebResourceResponse read(WebResourceRequest request) {
        boolean hasMarketHeader = request.getRequestHeaders().entrySet().stream().anyMatch(header ->
                "X-SmartBot-Market".equalsIgnoreCase(header.getKey()) && "daily".equals(header.getValue()));
        if (!"GET".equals(request.getMethod()) || !hasMarketHeader) return response(403, "Forbidden", new byte[0]);
        List<String> symbols = request.getUrl().getQueryParameters("symbol");
        if (symbols.size() != 1 || !symbols.get(0).matches("[A-Z]{1,5}")) {
            return response(400, "Invalid symbol", new byte[0]);
        }

        String query = "SELECT CAST(date AS CHAR) AS date, close FROM ohlcv WHERE act_symbol = '"
                + symbols.get(0) + "' AND date >= CURRENT_DATE - INTERVAL 400 DAY ORDER BY date DESC LIMIT 280";
        HttpURLConnection connection = null;
        try {
            URL url = new URL(Uri.parse(ENDPOINT).buildUpon().appendQueryParameter("q", query).build().toString());
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
