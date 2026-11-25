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
    private static final String ARCHIVE_URL =
            "https://github.com/Johnbrick123/sp500-data/releases/download/data/prices.parquet";

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

            ByteArrayOutputStream body = new ByteArrayOutputStream(length);
            try (InputStream stream = connection.getInputStream()) {
                byte[] buffer = new byte[4096];
                int count;
                while ((count = stream.read(buffer)) != -1) {
                    if (body.size() + count > length) throw new IOException("Market archive range exceeded");
                    body.write(buffer, 0, count);
                }
            }
            if (body.size() != length) throw new IOException("Incomplete market archive range");
            Map<String, String> headers = new HashMap<>();
            headers.put("Content-Length", String.valueOf(length));
            headers.put("Content-Range", contentRange);
            headers.put("ETag", etag);
            headers.put("Cache-Control", "no-store");
            return new WebResourceResponse("application/octet-stream", null, 206, "Partial Content", headers,
                    new ByteArrayInputStream(body.toByteArray()));
        } catch (IOException error) {
            return error(502, "Market archive unavailable");
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private static int offset(List<String> values) {
        return values.size() == 1 && values.get(0).matches("[0-9]{1,9}") ? Integer.parseInt(values.get(0)) : -1;
    }

    private static HttpURLConnection open(URL url, String range) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setInstanceFollowRedirects(false);
        connection.setConnectTimeout(10000);
        connection.setReadTimeout(10000);
        connection.setRequestProperty("Range", "bytes=" + range);
        connection.setRequestProperty("Accept-Encoding", "identity");
        return connection;
    }

    private static WebResourceResponse error(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason,
                java.util.Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
    }
}
