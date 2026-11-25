package io.github.trinamntn08.smartbot;

import android.net.Uri;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.Proxy;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

import okhttp3.Call;
import okhttp3.Dns;
import okhttp3.HttpUrl;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.ResponseBody;
import okio.BufferedSource;

final class PodcastDiscovery {
    private static final HttpUrl CATALOG = HttpUrl.get("https://itunes.apple.com/search");
    private static final HttpUrl HOSTED = HttpUrl.parse(BuildConfig.PODCAST_API);
    private static final int MAX_FEED_BYTES = 4 * 1024 * 1024;
    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .dns(PodcastDiscovery::resolvePublicHost)
            .proxy(Proxy.NO_PROXY)
            .followRedirects(false)
            .connectTimeout(5, TimeUnit.SECONDS)
            .readTimeout(5, TimeUnit.SECONDS)
            .build();

    static boolean isHostedRequest(Uri uri) {
        if (HOSTED == null || !HOSTED.isHttps() || !"https".equals(uri.getScheme())
                || !HOSTED.host().equals(uri.getHost()) || uri.getUserInfo() != null
                || HOSTED.port() != (uri.getPort() == -1 ? 443 : uri.getPort())) return false;
        String path = uri.getEncodedPath();
        return "/api/podcasts/search".equals(path) || "/api/podcasts/feed".equals(path);
    }

    static WebResourceResponse read(String endpoint, WebResourceRequest request) {
        if (!"GET".equals(request.getMethod())) return error(405, "Method Not Allowed", "Open the podcast from Music.");
        boolean search = "search".equals(endpoint);
        Uri uri = request.getUrl();
        HttpUrl source;
        if (search) {
            String value = uri.getQueryParameter("q");
            String query = value == null ? "" : value.trim();
            if (query.isEmpty() || query.length() > 120) {
                return error(400, "Bad Request", "Enter a podcast name up to 120 characters.");
            }
            String country = Locale.getDefault().getCountry();
            source = CATALOG.newBuilder().addQueryParameter("term", query)
                    .addQueryParameter("country", country.matches("[A-Z]{2}") ? country : "US")
                    .addQueryParameter("media", "podcast").addQueryParameter("entity", "podcast")
                    .addQueryParameter("limit", "15").build();
        } else if ("feed".equals(endpoint)) {
            String value = uri.getQueryParameter("url");
            source = value == null || value.length() > 2048 ? null : HttpUrl.parse(value.trim());
            if (!isPublicUrl(source)) return invalidFeedLink();
        } else {
            return error(404, "Not Found", "This podcast action is unavailable.");
        }
        return download(source, search);
    }

    private static WebResourceResponse download(HttpUrl source, boolean search) {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
        int limit = search ? 512 * 1024 : MAX_FEED_BYTES;
        String accept = search ? "application/json" : "application/rss+xml, application/xml, text/xml, */*;q=0.1";
        int redirects = search ? 0 : 4;
        try {
            for (int hop = 0; hop <= redirects; hop++) {
                Call call = CLIENT.newCall(new Request.Builder().url(source)
                        .header("User-Agent", "SmartBot/1.0 (podcast reader)").header("Accept", accept).build());
                call.timeout().deadlineNanoTime(deadline);
                try (Response response = call.execute()) {
                    if (response.isRedirect()) {
                        String location = response.header("Location");
                        source = location == null ? null : source.resolve(location);
                        if (!search && !isPublicUrl(source)) return invalidFeedLink();
                        continue;
                    }
                    if (response.code() == 429) {
                        return error(429, "Too Many Requests", "Too many podcast requests. Wait a moment and try again.");
                    }
                    ResponseBody body = response.body();
                    if (response.code() != 200 || body == null) break;
                    BufferedSource stream = body.source();
                    if (body.contentLength() > limit || stream.request(limit + 1L)) {
                        if (search) break;
                        return error(422, "Unprocessable Content", "This podcast feed is too large to open.");
                    }
                    String feedUrl = search ? null : source.newBuilder().fragment(null).build().toString();
                    return response(200, "OK", search ? "application/json" : "application/octet-stream",
                            stream.readByteArray(), feedUrl);
                }
            }
        } catch (IOException ignored) {
            // The app can retry a publisher or catalog request from the Music screen.
        }
        return error(502, "Bad Gateway", search ? "Podcast search is unavailable. You can still paste an RSS feed link."
                : "The podcast source could not be reached. Try again.");
    }

    private static boolean isPublicUrl(HttpUrl url) {
        if (url == null || !url.isHttps() || url.port() != 443 || !url.username().isEmpty() || !url.password().isEmpty()
                || url.toString().length() > 2048) return false;
        String host = url.host().replaceFirst("\\.$", "");
        // Public podcast publishers use DNS names. The resolver also checks the actual connection addresses.
        return host.contains(".") && !host.matches("[0-9.]+|.*\\.(?:local|internal|localhost|test|invalid)")
                && !host.contains(":");
    }

    private static List<InetAddress> resolvePublicHost(String host) throws UnknownHostException {
        List<InetAddress> addresses = Dns.SYSTEM.lookup(host);
        if (addresses.isEmpty() || addresses.stream().anyMatch(address -> !isPublicAddress(address))) {
            throw new UnknownHostException("A public podcast host is required");
        }
        return addresses;
    }

    private static boolean isPublicAddress(InetAddress address) {
        if (address.isAnyLocalAddress() || address.isLoopbackAddress() || address.isLinkLocalAddress()
                || address.isSiteLocalAddress() || address.isMulticastAddress()) return false;
        byte[] bytes = address.getAddress();
        int first = bytes[0] & 255;
        int second = bytes[1] & 255;
        int third = bytes[2] & 255;
        if (bytes.length == 4) {
            return first > 0 && first < 224 && !(first == 100 && second >= 64 && second <= 127)
                    && !(first == 192 && (second == 0 && (third == 0 || third == 2) || second == 88 && third == 99))
                    && !(first == 198 && (second == 18 || second == 19 || second == 51 && third == 100))
                    && !(first == 203 && second == 0 && third == 113);
        }
        // Global IPv6 unicast, excluding special-purpose and IPv4 transition ranges.
        return (first & 0xe0) == 0x20 && !(first == 0x20 && (second == 2
                || second == 1 && (third <= 1 || third == 0x0d && (bytes[3] & 255) == 0xb8)))
                && !(first == 0x3f && second == 0xff);
    }

    private static WebResourceResponse invalidFeedLink() {
        return error(400, "Bad Request", "Enter a public HTTPS podcast RSS link.");
    }

    private static WebResourceResponse error(int status, String reason, String message) {
        byte[] body = ("{\"error\":" + JSONObject.quote(message) + "}").getBytes(StandardCharsets.UTF_8);
        return response(status, reason, "application/json", body, null);
    }

    private static WebResourceResponse response(int status, String reason, String type, byte[] body, String feedUrl) {
        Map<String, String> headers = new HashMap<>();
        headers.put("Cache-Control", "no-store");
        headers.put("Content-Security-Policy", "default-src 'none'; sandbox");
        headers.put("X-Content-Type-Options", "nosniff");
        if (feedUrl != null) headers.put("X-SmartBot-Feed-Url", feedUrl);
        return new WebResourceResponse(type, null, status, reason, headers, new ByteArrayInputStream(body));
    }
}
