package io.github.trinamntn08.smartbot;

import android.app.Activity;
import android.content.ComponentName;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;

import androidx.annotation.OptIn;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;

import com.google.common.util.concurrent.ListenableFuture;

import org.json.JSONException;
import org.json.JSONObject;

import java.net.URI;
import java.util.Collections;
import java.util.concurrent.ExecutionException;

@OptIn(markerClass = UnstableApi.class)
final class PodcastBridge {
    private final Activity activity;
    private ListenableFuture<MediaController> connection;
    private boolean closed;

    PodcastBridge(Activity activity, WebView webView, String appOrigin) {
        this.activity = activity;
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(webView, "SmartBotPodcasts", Collections.singleton(appOrigin),
                    (view, message, origin, mainFrame, reply) -> {
                        if (mainFrame && appOrigin.equals(origin.toString())) receive(message.getData(), reply);
                    });
        }
    }

    private void receive(String data, JavaScriptReplyProxy reply) {
        if (closed || data == null || data.length() > 12_000) return;
        JSONObject request;
        try {
            request = new JSONObject(data);
        } catch (JSONException ignored) {
            return;
        }
        int requestId = request.optInt("requestId");
        String action = request.optString("action");
        try {
            if ("configuration".equals(action)) {
                respond(reply, requestId, BuildConfig.PODCAST_API, null);
                return;
            }
            if ("activity".equals(action)) {
                String date = request.getString("date");
                if (!date.matches("[0-9]{4}-[0-9]{2}-[0-9]{2}")) throw new IllegalArgumentException("Invalid activity date");
                respond(reply, requestId, PodcastActivityLog.read(activity, date), null);
                return;
            }
            if ("publisher".equals(action)) {
                activity.startActivity(new Intent(Intent.ACTION_VIEW, httpsUri(request.getString("url")))
                        .addCategory(Intent.CATEGORY_BROWSABLE));
                respond(reply, requestId, null, null);
                return;
            }
            if (connection == null) {
                SessionToken token = new SessionToken(activity, new ComponentName(activity, PodcastPlaybackService.class));
                connection = new MediaController.Builder(activity, token).buildAsync();
            }
            ListenableFuture<MediaController> pending = connection;
            pending.addListener(() -> {
                if (closed || connection != pending) return;
                try {
                    MediaController controller = pending.get();
                    control(controller, action, request);
                    respond(reply, requestId, snapshot(controller), null);
                } catch (InterruptedException error) {
                    Thread.currentThread().interrupt();
                    respond(reply, requestId, null, "The Android player was interrupted. Try again.");
                } catch (ExecutionException error) {
                    connection = null;
                    respond(reply, requestId, null, "The Android player could not start. Try again.");
                } catch (JSONException | IllegalArgumentException | IllegalStateException error) {
                    respond(reply, requestId, null, "The Android player could not load that episode.");
                }
            }, activity::runOnUiThread);
        } catch (RuntimeException | JSONException error) {
            respond(reply, requestId, null, "publisher".equals(action)
                    ? "The publisher page could not be opened." : "The Android player could not start. Try again.");
        }
    }

    private void control(MediaController controller, String action, JSONObject request) throws JSONException {
        switch (action) {
            case "state":
                return;
            case "play":
                JSONObject episode = request.getJSONObject("episode");
                String id = episode.getString("id");
                String title = episode.getString("title");
                String publisher = episode.optString("publisher");
                Uri uri = httpsUri(episode.getString("audioUrl"));
                if (id.isEmpty() || id.length() > 2200 || title.isEmpty() || title.length() > 300 || publisher.length() > 300) {
                    throw new IllegalArgumentException("Invalid episode metadata");
                }
                MediaItem current = controller.getCurrentMediaItem();
                if (current == null || !current.mediaId.equals(id) || !uri.equals(current.requestMetadata.mediaUri)) {
                    MediaMetadata metadata = new MediaMetadata.Builder().setTitle(title).setArtist(publisher).build();
                    MediaItem item = new MediaItem.Builder().setMediaId(id).setUri(uri).setMediaMetadata(metadata)
                            .setRequestMetadata(new MediaItem.RequestMetadata.Builder().setMediaUri(uri).build()).build();
                    long savedPosition = Math.round(PodcastPlaybackService.position(activity, id) * 1000);
                    controller.setMediaItem(item, savedPosition);
                }
                resume(controller);
                return;
            case "resume":
                resume(controller);
                return;
            case "pause":
                controller.pause();
                return;
            case "seek":
                double position = request.getDouble("position");
                long duration = controller.getDuration();
                if (Double.isFinite(position) && duration > 0 && controller.isCurrentMediaItemSeekable()) {
                    controller.seekTo(Math.min(duration, Math.max(0, Math.round(position * 1000))));
                }
                return;
            default:
                throw new IllegalArgumentException("Unknown player action");
        }
    }

    private static void resume(MediaController controller) {
        if (controller.getPlaybackState() == Player.STATE_IDLE) controller.prepare();
        if (controller.getPlaybackState() == Player.STATE_ENDED) controller.seekTo(0);
        controller.play();
    }

    private JSONObject snapshot(MediaController controller) throws JSONException {
        MediaItem current = controller.getCurrentMediaItem();
        if (current == null) {
            JSONObject last = PodcastPlaybackService.last(activity);
            return last == null ? new JSONObject() : last;
        }
        int state = controller.getPlaybackState();
        long duration = controller.getDuration();
        boolean playing = controller.getPlayWhenReady() && state != Player.STATE_ENDED && state != Player.STATE_IDLE;
        return new JSONObject().put("active", true).put("episode", PodcastPlaybackService.episode(current))
                .put("position", Math.max(0, controller.getCurrentPosition()) / 1000.0)
                .put("duration", duration == C.TIME_UNSET ? 0 : duration / 1000.0)
                .put("playing", playing).put("buffering", playing && state == Player.STATE_BUFFERING)
                .put("ended", state == Player.STATE_ENDED).put("error", controller.getPlayerError() == null
                        ? "" : "This episode could not play. Check your connection and retry.");
    }

    private static Uri httpsUri(String value) {
        URI uri = URI.create(value);
        if (value.length() > 2048 || !"https".equals(uri.getScheme()) || uri.getHost() == null
                || uri.getUserInfo() != null || (uri.getPort() != -1 && uri.getPort() != 443)) {
            throw new IllegalArgumentException("A public HTTPS link is required");
        }
        return Uri.parse(value);
    }

    private static void respond(JavaScriptReplyProxy reply, int requestId, Object value, String error) {
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) return;
        try {
            JSONObject message = new JSONObject().put("requestId", requestId)
                    .put("value", value == null ? JSONObject.NULL : value).put("error", error);
            reply.postMessage(message.toString());
        } catch (JSONException | IllegalStateException ignored) {
            // The original page may have closed before the player connected.
        }
    }

    void close() {
        closed = true;
        if (connection != null) MediaController.releaseFuture(connection);
    }
}
