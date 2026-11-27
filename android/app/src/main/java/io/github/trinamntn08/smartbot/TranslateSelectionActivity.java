package io.github.trinamntn08.smartbot;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.widget.Toast;

public final class TranslateSelectionActivity extends Activity {
    private static final int MAX_TRANSLATION_LENGTH = 5000;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (savedInstanceState == null) {
            openTranslation(getIntent());
        }
        finish();
    }

    private void openTranslation(Intent request) {
        if (!Intent.ACTION_PROCESS_TEXT.equals(request.getAction()) || !"text/plain".equals(request.getType())) {
            return;
        }
        CharSequence selection = request.getCharSequenceExtra(Intent.EXTRA_PROCESS_TEXT);
        if (selection == null) return;
        String text = selection.toString().trim();
        if (text.isEmpty()) return;
        if (text.length() > MAX_TRANSLATION_LENGTH) {
            Toast.makeText(this, R.string.translate_selection_too_long, Toast.LENGTH_SHORT).show();
            return;
        }

        String language = getResources().getConfiguration().getLocales().get(0).getLanguage();
        Uri translation = Uri.parse("https://translate.google.com/").buildUpon()
                .appendQueryParameter("sl", "auto")
                .appendQueryParameter("tl", language)
                .appendQueryParameter("text", text)
                .appendQueryParameter("op", "translate")
                .build();
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, translation));
        } catch (ActivityNotFoundException error) {
            Toast.makeText(this, R.string.translate_selection_no_browser, Toast.LENGTH_SHORT).show();
        }
    }
}
