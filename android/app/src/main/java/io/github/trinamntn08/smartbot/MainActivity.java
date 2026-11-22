package io.github.trinamntn08.smartbot;

import android.app.Activity;
import android.graphics.Insets;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.ServiceWorkerClient;
import android.webkit.ServiceWorkerController;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;

public final class MainActivity extends Activity {
    private static final String ASSET_PATH = "/assets/";
    private static final String APP_URL = "https://" + WebViewAssetLoader.DEFAULT_DOMAIN
            + ASSET_PATH + "index.html";

    private WebView webView;

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
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return appAsset(assetLoader, request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return !isAppAsset(request.getUrl());
            }
        });

        container.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
        setContentView(container);
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) {
            webView.loadUrl(APP_URL);
        }
    }

    private static boolean isAppAsset(Uri uri) {
        String path = uri.getPath();
        return "https".equals(uri.getScheme())
                && WebViewAssetLoader.DEFAULT_DOMAIN.equals(uri.getAuthority())
                && path != null && path.startsWith(ASSET_PATH);
    }

    private static WebResourceResponse appAsset(WebViewAssetLoader assetLoader, Uri uri) {
        if (!isAppAsset(uri)) {
            return null;
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
        ((FrameLayout) webView.getParent()).removeView(webView);
        webView.destroy();
        super.onDestroy();
    }
}
