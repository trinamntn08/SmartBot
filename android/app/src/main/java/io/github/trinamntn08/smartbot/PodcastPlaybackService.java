package io.github.trinamntn08.smartbot;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;

import androidx.annotation.OptIn;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

import org.json.JSONException;
import org.json.JSONObject;

@OptIn(markerClass = UnstableApi.class)
public final class PodcastPlaybackService extends MediaSessionService {
    private static final long CHECKPOINT_INTERVAL_MS = 5_000;
    static final String OPEN_MUSIC = "io.github.trinamntn08.smartbot.OPEN_MUSIC";
    private static final String LAST = "last";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable checkpoint = new Runnable() {
        @Override
        public void run() {
            saveCurrent();
            if (player.isPlaying()) handler.postDelayed(this, CHECKPOINT_INTERVAL_MS);
        }
    };
    private ExoPlayer player;
    private MediaSession session;

    @Override
    public void onCreate() {
        super.onCreate();
        AudioAttributes attributes = new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA)
                .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH).build();
        player = new ExoPlayer.Builder(this).setAudioAttributes(attributes, true)
                .setHandleAudioBecomingNoisy(true).setSeekBackIncrementMs(15_000)
                .setWakeMode(C.WAKE_MODE_NETWORK).build();
        player.addListener(new Player.Listener() {
            @Override
            public void onIsPlayingChanged(boolean playing) {
                handler.removeCallbacks(checkpoint);
                saveCurrent();
                if (playing) handler.postDelayed(checkpoint, CHECKPOINT_INTERVAL_MS);
            }

            @Override
            public void onPositionDiscontinuity(Player.PositionInfo before, Player.PositionInfo after, int reason) {
                if (before.mediaItem != null && after.mediaItem != null
                        && !before.mediaItem.mediaId.equals(after.mediaItem.mediaId)) {
                    JSONObject previous = saved(PodcastPlaybackService.this, "episode:" + before.mediaItem.mediaId);
                    save(before.mediaItem, before.positionMs, previous != null && previous.optBoolean("ended"), false);
                }
                if (reason == Player.DISCONTINUITY_REASON_SEEK) saveCurrent();
            }

            @Override
            public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) saveCurrent();
            }

            @Override
            public void onMediaItemTransition(MediaItem item, int reason) {
                saveCurrent();
            }
        });
        Intent open = new Intent(this, MainActivity.class).setAction(OPEN_MUSIC)
                .addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        session = new MediaSession.Builder(this, player).setSessionActivity(PendingIntent.getActivity(
                this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT)).build();
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controller) {
        return session;
    }

    private void saveCurrent() {
        MediaItem item = player.getCurrentMediaItem();
        if (item != null) save(item, player.getCurrentPosition(), player.getPlaybackState() == Player.STATE_ENDED, true);
    }

    private void save(MediaItem item, long position, boolean ended, boolean latest) {
        try {
            JSONObject progress = new JSONObject().put("episode", episode(item))
                    .put("position", Math.max(0, position) / 1000.0).put("ended", ended);
            SharedPreferences.Editor edit = preferences(this).edit().putString("episode:" + item.mediaId, progress.toString());
            if (latest) edit.putString(LAST, progress.toString());
            edit.apply();
        } catch (JSONException ignored) {
            // Invalid metadata cannot replace a saved listening position.
        }
    }

    static JSONObject episode(MediaItem item) throws JSONException {
        Uri uri = item.requestMetadata.mediaUri;
        if (item.localConfiguration != null) uri = item.localConfiguration.uri;
        return new JSONObject().put("id", item.mediaId).put("title", item.mediaMetadata.title)
                .put("publisher", item.mediaMetadata.artist).put("audioUrl", uri == null ? "" : uri.toString());
    }

    static JSONObject last(Context context) {
        return saved(context, LAST);
    }

    static double position(Context context, String id) {
        JSONObject progress = saved(context, "episode:" + id);
        return progress == null || progress.optBoolean("ended") ? 0 : progress.optDouble("position", 0);
    }

    private static SharedPreferences preferences(Context context) {
        return context.getSharedPreferences("podcast-playback", MODE_PRIVATE);
    }

    private static JSONObject saved(Context context, String key) {
        String saved = preferences(context).getString(key, null);
        try {
            return saved == null ? null : new JSONObject(saved);
        } catch (JSONException ignored) {
            return null;
        }
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacks(checkpoint);
        saveCurrent();
        session.release();
        player.release();
        super.onDestroy();
    }
}
