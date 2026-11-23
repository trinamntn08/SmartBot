"""Exercise the local API boundary without contacting paid providers."""

import io
import json
import os
from functools import partial
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path
import sys
from threading import Thread
import unittest
from unittest.mock import patch
import wave

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import assistant_api
from preview import PreviewHandler, WEB_ROOT


class AssistantApiTests(unittest.TestCase):
    def setUp(self):
        keys = patch.dict(os.environ, {"SMARTBOT_OPENAI_API_KEY": "fixture-key"}, clear=True)
        keys.start()
        self.addCleanup(keys.stop)
        handler = partial(PreviewHandler, directory=WEB_ROOT)
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
        thread = Thread(target=self.server.serve_forever, kwargs={"poll_interval": 0.01}, daemon=True)
        thread.start()
        self.addCleanup(self.server.server_close)
        self.addCleanup(thread.join)
        self.addCleanup(self.server.shutdown)

    def request(self, suffix="", body=None, headers=None):
        connection = HTTPConnection("127.0.0.1", self.server.server_port, timeout=2)
        try:
            request_headers = {
                "Content-Type": "application/json",
                "X-SmartBot-Provider": "openai",
                **(headers or {}),
            }
            connection.request("GET" if body is None else "POST", f"/api/assistant{suffix}", body, request_headers)
            response = connection.getresponse()
            return response.status, json.load(response)
        finally:
            connection.close()

    @patch.object(assistant_api, "provider_request")
    def test_exposes_provider_names_and_routes_a_question(self, upstream):
        upstream.return_value = {"choices": [{"message": {"content": "A reply"}}]}
        self.assertEqual(self.request(), (200, {"providers": [{"id": "openai", "label": "OpenAI"}]}))
        message = {"role": "user", "content": "  A question  "}
        status, body = self.request("/ask", json.dumps({"messages": [message]}))
        self.assertEqual((status, body), (200, {"text": "A reply"}))
        self.assertEqual(upstream.call_args.kwargs["payload"]["messages"], [{"role": "user", "content": "A question"}])

    @patch.object(assistant_api, "provider_request")
    def test_rejects_cross_origin_hosts_and_invalid_conversations(self, upstream):
        question = json.dumps({"messages": [{"role": "user", "content": "A question"}]})
        for headers in ({"Origin": "https://other.example"}, {"Host": "other.example"}):
            with self.subTest(headers=headers):
                self.assertEqual(self.request("/ask", question, headers)[0], 403)
        self.assertEqual(self.request("/ask", '{"messages":[{"role":"system","content":"hi"}]}')[0], 400)
        self.assertEqual(self.request("/ask", question, {"X-SmartBot-Provider": "gemini"})[0], 503)
        upstream.assert_not_called()

    @patch.object(assistant_api, "provider_request")
    def test_transcription_returns_a_draft_without_requesting_a_reply(self, upstream):
        upstream.return_value = {"text": "Voice question"}
        output = io.BytesIO()
        with wave.open(output, "wb") as wav:
            wav.setparams((1, 2, 16000, 0, "NONE", "not compressed"))
            wav.writeframes(bytes(3200))
        status, body = self.request("/transcribe", output.getvalue(), {"Content-Type": "audio/wav"})
        self.assertEqual((status, body), (200, {"text": "Voice question"}))
        upstream.assert_called_once()
        self.assertEqual(upstream.call_args.args[0], "https://api.openai.com/v1/audio/transcriptions")

    @patch.object(assistant_api, "provider_request")
    def test_gemini_preserves_turns_and_skips_thinking_parts(self, upstream):
        upstream.return_value = {
            "candidates": [{"content": {"parts": [{"thought": True, "text": "Internal"}, {"text": "A reply"}]}}]
        }
        with patch.dict(os.environ, {"SMARTBOT_GEMINI_API_KEY": "fixture-gemini-key"}):
            messages = [
                {"role": "user", "content": "A question"},
                {"role": "assistant", "content": "First reply"},
                {"role": "user", "content": "A follow-up"},
            ]
            status, body = self.request("/ask", json.dumps({"messages": messages}), {"X-SmartBot-Provider": "gemini"})
        self.assertEqual((status, body), (200, {"text": "A reply"}))
        parts = upstream.call_args.kwargs["payload"]["contents"]
        self.assertEqual([part["role"] for part in parts], ["user", "model", "user"])
