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

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final int OPEN_BOOK = 1;
    private static final String ASSET_PATH = "/assets/";
    private static final String APP_URL = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN
            + ASSET_PATH + "index.html";

    private WebView webView;
    private ValueCallback<Uri[]> selectedBook;

    @Override
    @SuppressWarnings("SetJavaScriptEnabled") // SmartBot only loads its own bundled web app.
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
        ServiceWorkerController.getInstance().setServiceWorkerClient(new ServiceWorkerClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebResourceRequest request) {
                return appAsset(assetLoader, request.getUrl());
            }
        });

        webView = new WebView(this);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
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
                return appAsset(assetLoader, request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (isAppAsset(uri)) return false;
                if (request.isForMainFrame() && request.hasGesture() && "https".equals(uri.getScheme())
                        && isPublisher(uri.getAuthority())) {
                    try {
                        startActivity(new Intent(Intent.ACTION_VIEW, uri));
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
            webView.loadUrl(APP_URL);
        }
    }

    @SuppressWarnings("deprecation")
    private boolean chooseBook(ValueCallback<Uri[]> callback) {
        if (selectedBook != null) return false;
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                .addCategory(Intent.CATEGORY_OPENABLE)
                .setType("text/plain")
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

    @Override
    @SuppressWarnings("deprecation")
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
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
                || "www.nasa.gov".equals(host);
    }

    private static WebResourceResponse appAsset(WebViewAssetLoader assetLoader, Uri uri) {
        if (!isAppAsset(uri)) {
            String host = uri.getAuthority();
            if ("https".equals(uri.getScheme()) && ("api.io.canada.ca".equals(host)
                    || "www.canada.ca".equals(host) || "www.nasa.gov".equals(host))) return null;
            return new WebResourceResponse("text/plain", "UTF-8", 403, "Forbidden",
                    Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
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
        if (selectedBook != null) selectedBook.onReceiveValue(null);
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
