"""Browse and search the public YouTube music catalog."""

from http.client import HTTPException, HTTPSConnection
import json
import os
from urllib.parse import urlencode

from youtube_key_store import key_path, load_key, save_key, valid_key


HOST = "www.googleapis.com"
MAX_RESPONSE = 128 * 1024
MUSIC_REGIONS = {"FR", "VN", "US"}


class YouTubeError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status


def environment_key():
    return os.environ.get("SMARTBOT_YOUTUBE_API_KEY", "").strip()


def key_status():
    key = environment_key()
    return {
        "configured": bool(key or load_key()),
        "canSaveKey": not key and key_path() is not None,
    }


def update_key(key):
    path = key_path()
    if path is None or environment_key():
        raise YouTubeError(403, "Manage the API key in the SmartBot preview environment.")
    if not isinstance(key, str) or (key and not valid_key(key)):
        raise YouTubeError(400, "Enter a valid YouTube Data API key.")
    try:
        save_key(path, key)
    except OSError:
        raise YouTubeError(500, "SmartBot could not update the saved key. Try again.") from None
    return {"configured": bool(key), "canSaveKey": True}


def search_music(query):
    query = query.strip()
    if not 1 <= len(query) <= 120:
        raise YouTubeError(400, "Enter a song or artist name.")
    return youtube_videos("search", {
        "part": "snippet",
        "type": "video",
        "videoCategoryId": "10",
        "videoEmbeddable": "true",
        "videoSyndicated": "true",
        "maxResults": "8",
        "fields": "items(id/videoId,snippet(title,channelTitle))",
        "q": query,
    })


def popular_music(region):
    if region not in MUSIC_REGIONS:
        raise YouTubeError(400, "Choose an available YouTube chart.")
    return youtube_videos("videos", {
        "part": "snippet,status",
        "chart": "mostPopular",
        "regionCode": region,
        "videoCategoryId": "10",
        "maxResults": "16",
        "fields": "items(id,snippet(title,channelTitle,thumbnails(medium/url)),status/embeddable)",
    })


def youtube_videos(resource, params):
    key = environment_key() or load_key()
    if not key:
        raise YouTubeError(503, "Configure a YouTube Data API key to search.")
    connection = HTTPSConnection(HOST, timeout=8)
    try:
        connection.request("GET", f"/youtube/v3/{resource}?{urlencode(params)}", headers={"X-Goog-Api-Key": key})
        response = connection.getresponse()
        body = response.read(MAX_RESPONSE + 1)
        if len(body) > MAX_RESPONSE:
            raise YouTubeError(502, "YouTube returned a response that was too large.")
        data = json.loads(body)
        if not isinstance(data, dict):
            raise ValueError("Invalid YouTube response")
        if response.status == 200 and isinstance(data.get("items"), list):
            return data
        details = data.get("error", {})
        reasons = {item.get("reason") for item in details.get("errors", [])}
        if response.status == 429 or reasons.intersection({"quotaExceeded", "dailyLimitExceeded", "rateLimitExceeded"}):
            message = "YouTube's search limit was reached." if resource == "search" else "YouTube's chart limit was reached."
            raise YouTubeError(429, f"{message} Try again later.")
        if response.status in (400, 401, 403):
            raise YouTubeError(403, "Check your API key and enable YouTube Data API v3 for its project.")
    except (OSError, HTTPException, TypeError, ValueError, AttributeError):
        raise YouTubeError(502, "YouTube could not be reached. Try again.") from None
    finally:
        connection.close()
    raise YouTubeError(502, "YouTube is temporarily unavailable.")
