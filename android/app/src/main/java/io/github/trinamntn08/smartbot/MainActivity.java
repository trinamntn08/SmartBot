package io.github.trinamntn08.smartbot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Process;
import android.util.Base64;
import android.view.WindowInsets;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final int OPEN_BOOK = 1;
    private static final int SAVE_BOOK = 2;
    private static final int MAX_EXPORT_LENGTH = 28 * 1024 * 1024;
    private static final String ASSET_PATH = "/assets/";
    private static final String APP_ORIGIN = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN;
    private static final String APP_URL = APP_ORIGIN + ASSET_PATH + "index.html";

    private WebView webView;
    private PodcastBridge podcasts;
    private ValueCallback<Uri[]> selectedBook;
    private String pendingExport;
    private JavaScriptReplyProxy exportReply;

    @Override
    @SuppressWarnings("SetJavaScriptEnabled") // Top-level web content is bundled with SmartBot.
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout container = new FrameLayout(this);
        if (Build.VERSION.SDK_INT >= 35) {
            container.setOnApplyWindowInsetsListener((view, insets) -> {
                int safeAreas = WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout()
                        | WindowInsets.Type.ime();
                Insets padding = insets.getInsets(safeAreas);
                view.setPadding(padding.left, padding.top, padding.right, padding.bottom);
                return insets;
            });
        }

        WebViewAssetLoader assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler(ASSET_PATH, new WebViewAssetLoader.AssetsPathHandler(getApplicationContext()))
                .build();
        NewsFeed newsFeed = new NewsFeed(getAssets());
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return appAsset(assetLoader, newsFeed, request);
            }
        });

        webView = new WebView(this);
        podcasts = new PodcastBridge(this, webView, APP_ORIGIN);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "SmartBotFiles",
                    Collections.singleton("https://" + WebViewAssetLoader.DEFAULT_DOMAIN),
                    (view, message, origin, isMainFrame, reply) -> {
                        if (isMainFrame) chooseExport(message.getData(), reply);
                    });
        }
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                    FileChooserParams parameters) {
                return chooseBook(callback);
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return appAsset(assetLoader, newsFeed, request);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAppAsset(uri)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(uri.getScheme())
                        && (isPublisher(uri.getAuthority()) || newsFeed.isPublisher(uri.getAuthority())
                        || isMarketSource(uri) || isGoogleSearch(uri))) {
                    try {
                        Intent article = new Intent(Intent.ACTION_VIEW, uri);
                        Bundle extras = new Bundle();
                        extras.putBinder("android.support.customtabs.extra.SESSION", null);
                        article.putExtras(extras);
                        startActivity(article);
                    } catch (ActivityNotFoundException error) {
                        Toast.makeText(MainActivity.this, "No browser available", Toast.LENGTH_SHORT).show();
                    }
                }
                return true;
            }
        });

        container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(container);
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(PodcastPlaybackService.OPEN_MUSIC.equals(getIntent().getAction()) ? APP_URL + "#music" : APP_URL);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (PodcastPlaybackService.OPEN_MUSIC.equals(intent.getAction())) webView.loadUrl(APP_URL + "#music");
    }

    @SuppressWarnings("deprecation")
    private boolean chooseBook(ValueCallback<Uri[]> callback) {
        if (selectedBook != null) return false;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"text/plain", "application/pdf"})
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            selectedBook = callback;
            startActivityForResult(intent, OPEN_BOOK);
            return true;
        } catch (ActivityNotFoundException error) {
            selectedBook = null;
            return false;
        }
    }

    @SuppressWarnings("deprecation")
    private void chooseExport(String payload, JavaScriptReplyProxy reply) {
        if (exportReply != null || payload == null || payload.length() > MAX_EXPORT_LENGTH) {
            reportExport(reply, "failed");
            return;
        }
        try {
            JSONObject export = new JSONObject(payload);
            String type = export.getString("type");
            if (!"application/pdf".equals(type) && !"application/epub+zip".equals(type)) {
                reportExport(reply, "failed");
                return;
            }
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType(type)
                    .putExtra(Intent.EXTRA_TITLE, export.getString("name"));
            pendingExport = export.getString("data");
            exportReply = reply;
            startActivityForResult(intent, SAVE_BOOK);
        } catch (JSONException | ActivityNotFoundException error) {
            pendingExport = null;
            exportReply = null;
            reportExport(reply, "failed");
        }
    }

    private static void reportExport(JavaScriptReplyProxy reply, String result) {
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            reply.postMessage(result);
        }
    }

    private void finishExport(int resultCode, Intent data) {
        if (exportReply == null) return;
        Uri file = resultCode == RESULT_OK && data != null ? data.getData() : null;
        JavaScriptReplyProxy reply = exportReply;
        String encoded = pendingExport;
        pendingExport = null;
        if (file == null || !"content".equals(file.getScheme())) {
            exportReply = null;
            reportExport(reply, "cancelled");
            return;
        }
        new Thread(() -> {
            String outcome = "failed";
            try (OutputStream output = getContentResolver().openOutputStream(file, "wt")) {
                if (output != null) {
                    output.write(Base64.decode(encoded, Base64.DEFAULT));
                    outcome = "saved";
                }
            } catch (IOException | IllegalArgumentException | SecurityException error) {
                outcome = "failed";
            }
            String result = outcome;
            runOnUiThread(() -> {
                exportReply = null;
                if (!isDestroyed()) reportExport(reply, result);
            });
        }, "book-export").start();
    }

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == SAVE_BOOK) {
            finishExport(resultCode, data);
            return;
        }
        if (requestCode != OPEN_BOOK || selectedBook == null) return;

        ValueCallback<Uri[]> callback = selectedBook;
        selectedBook = null;
        Uri file = resultCode == RESULT_OK && data != null ? data.getData() : null;
        boolean readable = file != null && "content".equals(file.getScheme())
                && checkUriPermission(file, Process.myPid(), Process.myUid(),
                        Intent.FLAG_GRANT_READ_URI_PERMISSION) == PackageManager.PERMISSION_GRANTED;
        callback.onReceiveValue(readable ? new Uri[]{file} : null);
    }

    private static boolean isAppAsset(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme())
                && WebViewAssetLoader.DEFAULT_DOMAIN.equals(uri.getAuthority())
                && path != null && path.startsWith(ASSET_PATH);
    }

    private static boolean isPublisher(String host) {
        return "www.canada.ca".equals(host) || "science.nasa.gov".equals(host)
                || "www.nasa.gov".equals(host) || "tuoitre.vn".equals(host);
    }

    private static boolean isGoogleSearch(Uri uri) {
        return "www.google.com".equals(uri.getAuthority()) && "/search".equals(uri.getPath());
    }

    private static boolean isMarketSource(Uri uri) {
        String path = uri.getPath();
        return ("www.tradingview.com".equals(uri.getAuthority()) && path != null && path.startsWith("/symbols/"))
                || ("www.dolthub.com".equals(uri.getAuthority()) && "/repositories/post-no-preference/stocks".equals(path))
                || ("github.com".equals(uri.getAuthority()) && ("/Johnbrick123/sp500-data".equals(path)
                    || "/daniegitx1/btc-price-history".equals(path) || "/akpasz/btc-data".equals(path)))
                || ("www.bitstamp.net".equals(uri.getAuthority()) && "/api/".equals(path))
                || ("www.dnse.com.vn".equals(uri.getAuthority()) && "/".equals(path))
                || "www.alphavantage.co".equals(uri.getAuthority());
    }

    private static WebResourceResponse appAsset(WebViewAssetLoader assetLoader, NewsFeed newsFeed,
            WebResourceRequest request) {
        Uri uri = request.getUrl();
        if (!isAppAsset(uri)) {
            if (PodcastDiscovery.isHostedRequest(uri)) return null;
            String host = uri.getAuthority();
            if ("https".equals(uri.getScheme()) && ("www.canada.ca".equals(host) || "www.nasa.gov".equals(host)
                    || "science.nasa.gov".equals(host))) return null;
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
        }
        if ((ASSET_PATH + "api/markets/archive").equals(uri.getPath())) return MarketFeed.read(request);
        if ((ASSET_PATH + "api/markets/crypto").equals(uri.getPath())) return MarketFeed.crypto(request);
        if ((ASSET_PATH + "api/markets/vietnam").equals(uri.getPath())) return MarketFeed.vietnam(request);
        String podcastPath = ASSET_PATH + "api/podcasts/";
        if (uri.getEncodedPath().startsWith(podcastPath)) {
            return PodcastDiscovery.read(uri.getEncodedPath().substring(podcastPath.length()), request);
        }
        String feedPrefix = ASSET_PATH + "api/news/";
        if (uri.getEncodedPath().startsWith(feedPrefix)) {
            String id = uri.getEncodedQuery() == null ? uri.getEncodedPath().substring(feedPrefix.length()) : null;
            return newsFeed.readPublisher(id);
        }
        String tuoitrePrefix = ASSET_PATH + "api/tuoitre/";
        if (uri.getPath().startsWith(tuoitrePrefix)) {
            return NewsFeed.readTuoitre(uri.getPath().substring(tuoitrePrefix.length()));
        }
        if ((ASSET_PATH + "sw.js").equals(uri.getPath())) {
            // The APK already supplies these files offline. Avoid caching them across APK updates.
            byte[] body = "// SmartBot's Android assets are bundled with the app."
                    .getBytes(StandardCharsets.UTF_8);
            return new WebResourceResponse("text/javascript", "UTF-8", 200, "OK",
                    Collections.singletonMap("Cache-Control", "no-store"), new ByteArrayInputStream(body));
        }
        return assetLoader.shouldInterceptRequest(uri);
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        podcasts.close();
        if (selectedBook != null) selectedBook.onReceiveValue(null);
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
