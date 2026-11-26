package io.github.trinamntn08.smartbot;

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
    private static final int MAX_RANGE = 2 * 1024 * 1024;
    private static final int MAX_HISTORY = 128 * 1024;
    private static final String ARCHIVE_URL =
            "https://github.com/Johnbrick123/sp500-data/releases/download/data/prices.parquet";
    private static final String BITCOIN_CSV =
            "https://raw.githubusercontent.com/daniegitx1/btc-price-history/main/data/btc_usd_daily.csv";
    private static final String COINBASE_HISTORY =
            "https://raw.githubusercontent.com/akpasz/btc-data/main/data/relative.json";
    private static final String DNSE_HISTORY = "https://services.entrade.com.vn/chart-api/v2/ohlcs/stock";

    static WebResourceResponse read(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return error(403, "Forbidden");
        int start = offset(request.getUrl().getQueryParameters("start"));
        int end = offset(request.getUrl().getQueryParameters("end"));
        int length = end - start + 1;
        if (start < 0 || end < 0 || length < 1 || length > MAX_RANGE) return error(400, "Invalid range");

        String range = start + "-" + end;
        HttpURLConnection connection = null;
        try {
            connection = open(new URL(ARCHIVE_URL), range);
            if (connection.getResponseCode() == 302) {
                String location = connection.getHeaderField("Location");
                connection.disconnect();
                URL destination = new URL(location);
                if (!"https".equals(destination.getProtocol())
                        || !"release-assets.githubusercontent.com".equals(destination.getAuthority())) {
                    throw new IOException("Unexpected market archive host");
                }
                connection = open(destination, range);
            }
            if (connection.getResponseCode() != 206) throw new IOException("Market archive range unavailable");
            String contentRange = connection.getHeaderField("Content-Range");
            String etag = connection.getHeaderField("ETag");
            if (contentRange == null || !contentRange.startsWith("bytes " + range + "/") || etag == null) {
                throw new IOException("Market archive range mismatch");
            }

            byte[] body = readBody(connection, length);
            if (body.length != length) throw new IOException("Incomplete market archive range");
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Length", String.valueOf(length));
            headers.put("Content-Range", contentRange);
            headers.put("ETag", etag);
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse("application/octet-stream", null, 206, "Partial Content", headers,
                    new ByteArrayInputStream(body));
        } catch (IOException error) {
            return error(502, "Market archive unavailable");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    static WebResourceResponse crypto(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return error(403, "Forbidden");
        String symbol = parameter(request, "symbol");
        String source = parameter(request, "source");
        if (!symbol.matches("[A-Z0-9]{2,12}-USD")) return error(400, "Invalid cryptocurrency pair");
        String pair = symbol.replace("-", "").toLowerCase(java.util.Locale.ROOT);
        if ("bitstamp-ticker".equals(source)) {
            String url = "https://www.bitstamp.net/api/v2/ticker/" + pair + "/";
            return downloadHistory(url, "application/json", MAX_HISTORY, "Cryptocurrency quote unavailable");
        }
        String mimeType = "application/json";
        String url;
        int limit = MAX_RANGE;
        if ("bitstamp".equals(source)) {
            url = "https://www.bitstamp.net/api/v2/ohlc/" + pair + "/?step=86400&limit=400&exclude_current_candle=true";
            limit = MAX_HISTORY;
        } else if ("archive".equals(source) && "BTC-USD".equals(symbol)) {
            url = BITCOIN_CSV;
            mimeType = "text/csv";
        } else if ("archive".equals(source) && symbol.matches("(ETH|SOL|PAXG)-USD")) {
            url = COINBASE_HISTORY;
        } else {
            return error(400, "Invalid cryptocurrency source");
        }
        return downloadHistory(url, mimeType, limit, "Cryptocurrency history unavailable");
    }

    static WebResourceResponse vietnam(WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return error(403, "Forbidden");
        String symbol = parameter(request, "symbol");
        if (!symbol.matches("[A-Z0-9]{3}")) return error(400, "Invalid Vietnamese stock symbol");

        long end = System.currentTimeMillis() / 1000;
        String url = DNSE_HISTORY + "?symbol=" + symbol + "&resolution=1D&from=" + (end - 400L * 86400) + "&to=" + end;
        return downloadHistory(url, "application/json", MAX_HISTORY, "Vietnamese stock history unavailable");
    }

    private static WebResourceResponse downloadHistory(String url, String mimeType, int limit, String message) {
        HttpURLConnection connection = null;
        try {
            connection = connect(new URL(url));
            connection.setRequestProperty("User-Agent", "SmartBot");
            if (connection.getResponseCode() != 200) throw new IOException(message);
            byte[] body = readBody(connection, limit);
            if (body.length == 0) throw new IOException("Empty market history");
            return new WebResourceResponse(mimeType, "UTF-8", 200, "OK",
                    java.util.Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(body));
        } catch (IOException error) {
            return error(502, message);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static String parameter(WebResourceRequest request, String name) {
        List<String> values = request.getUrl().getQueryParameters(name);
        return values.size() == 1 ? values.get(0) : "";
    }

    private static byte[] readBody(HttpURLConnection connection, int limit) throws IOException {
        ByteArrayOutputStream body = new ByteArrayOutputStream();
        try (InputStream stream = connection.getInputStream()) {
            byte[] buffer = new byte[4096];
            int count;
            while ((count = stream.read(buffer)) != -1) {
                if (body.size() + count > limit) throw new IOException("Market response too large");
                body.write(buffer, 0, count);
            }
        }
        return body.toByteArray();
    }

    private static int offset(List<String> values) {
        return values.size() == 1 && values.get(0).matches("[0-9]{1,9}") ? Integer.parseInt(values.get(0)) : -1;
    }

    private static HttpURLConnection open(URL url, String range) throws IOException {
        HttpURLConnection connection = connect(url);
        connection.setRequestProperty("Range", "bytes=" + range);
        return connection;
    }

    private static HttpURLConnection connect(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("Accept-Encoding", "identity");
        return connection;
    }

    private static WebResourceResponse error(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
                java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
