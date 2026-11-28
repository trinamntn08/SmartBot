package io.github.trinamntn08.smartbot;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.webkit.WebView;

import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.Text;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;

import java.util.Collections;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import org.json.JSONObject;

final class BookOcr {
    private static final int MAX_IMAGE_MESSAGE = 4 * 1024 * 1024;
    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private TextRecognizer recognizer;
    private boolean busy;
    private boolean closed;

    BookOcr(WebView view, String origin) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        WebViewCompat.addWebMessageListener(view, "SmartBotBookOcr", Collections.singleton(origin),
                (webView, message, sourceOrigin, isMainFrame, reply) -> {
                    if (!isMainFrame || closed) return;
                    String encoded = message.getData();
                    if (busy || encoded == null || encoded.length() > MAX_IMAGE_MESSAGE) {
                        reply.postMessage("null");
                        return;
                    }
                    if (recognizer == null) {
                        recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
                    }
                    TextRecognizer current = recognizer;
                    busy = true;
                    worker.execute(() -> {
                        Bitmap bitmap = null;
                        try {
                            byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
                            bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
                            if (bitmap == null) throw new IllegalArgumentException("Invalid page image");
                            Bitmap page = bitmap;
                            current.process(InputImage.fromBitmap(page, 0)).addOnCompleteListener(task -> {
                                page.recycle();
                                busy = false;
                                if (!closed) reply.postMessage(task.isSuccessful()
                                        ? JSONObject.quote(paragraphs(task.getResult())) : "null");
                            });
                        } catch (RuntimeException error) {
                            if (bitmap != null) bitmap.recycle();
                            webView.post(() -> {
                                busy = false;
                                if (!closed) reply.postMessage("null");
                            });
                        }
                    });
                });
    }

    private static String paragraphs(Text result) {
        StringBuilder text = new StringBuilder();
        for (Text.TextBlock block : result.getTextBlocks()) {
            if (text.length() > 0) text.append("\n\n");
            text.append(block.getText().replace('\n', ' '));
        }
        return text.toString();
    }

    void close() {
        closed = true;
        worker.execute(() -> {
            if (recognizer != null) recognizer.close();
        });
        worker.shutdown();
    }
}
