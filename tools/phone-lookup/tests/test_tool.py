"""Tests for the privacy-preserving Phone Lookup module."""
import importlib.util
import io
import json
import os
import sys
import unittest
from pathlib import Path
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "backend"))

MODULE_PATH = ROOT / "tools" / "phone-lookup" / "backend" / "tool.py"
SPEC = importlib.util.spec_from_file_location("phone_lookup_tool_under_test", MODULE_PATH)
PHONE_MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PHONE_MODULE)


class PhoneLookupSearchTests(unittest.TestCase):
    def _response(self, payload):
        return io.BytesIO(json.dumps(payload).encode("utf-8"))

    def test_reports_unconfigured_without_network(self):
        with patch.dict(os.environ, {}, clear=True), patch.object(PHONE_MODULE, "urlopen") as urlopen:
            result = PHONE_MODULE._search_public_web("+12025550123")
        self.assertFalse(result["configured"])
        self.assertEqual(result["status"], "not_configured")
        urlopen.assert_not_called()

    def test_brave_search_runs_seven_public_categories_and_deduplicates(self):
        payload = {
            "web": {
                "results": [{
                    "title": "Public contact page",
                    "url": "https://example.org/contact",
                    "description": "Publicly indexed contact reference",
                }]
            }
        }
        with patch.dict(os.environ, {"BRAVE_SEARCH_API_KEY": "test-token"}, clear=True):
            with patch.object(PHONE_MODULE, "urlopen", side_effect=lambda *a, **k: self._response(payload)) as urlopen:
                result = PHONE_MODULE._search_public_web("+12025550123")

        self.assertEqual(result["provider"], "Brave Search")
        self.assertEqual(result["status"], "completed")
        self.assertEqual(len(result["services"]), 7)
        self.assertEqual(len(result["results"]), 1)
        self.assertEqual(result["results"][0]["url"], "https://example.org/contact")
        self.assertEqual(urlopen.call_count, 7)
        first_request = urlopen.call_args_list[0].args[0]
        self.assertEqual(first_request.get_header("X-subscription-token"), "test-token")
        query = parse_qs(urlparse(first_request.full_url).query)["q"][0]
        self.assertIn("+12025550123", query)

    def test_legacy_google_cse_remains_supported(self):
        payload = {
            "items": [{
                "title": "Legacy result",
                "link": "https://example.net/page",
                "snippet": "A public page",
            }]
        }
        env = {
            "GOOGLE_CSE_API_KEY": "legacy-key",
            "GOOGLE_CSE_CX": "engine-id",
        }
        with patch.dict(os.environ, env, clear=True):
            with patch.object(PHONE_MODULE, "urlopen", side_effect=lambda *a, **k: self._response(payload)) as urlopen:
                result = PHONE_MODULE._search_public_web("+12025550123")

        self.assertEqual(result["provider"], "Google Custom Search")
        self.assertEqual(result["results"][0]["title"], "Legacy result")
        first_request = urlopen.call_args_list[0].args[0]
        params = parse_qs(urlparse(first_request.full_url).query)
        self.assertEqual(params["key"], ["legacy-key"])
        self.assertEqual(params["cx"], ["engine-id"])

    def test_brave_is_preferred_when_both_providers_are_configured(self):
        with patch.dict(os.environ, {
            "BRAVE_SEARCH_API_KEY": "brave-token",
            "GOOGLE_CSE_API_KEY": "legacy-key",
            "GOOGLE_CSE_CX": "engine-id",
        }, clear=True):
            with patch.object(PHONE_MODULE, "urlopen", side_effect=OSError("offline")) as urlopen:
                result = PHONE_MODULE._search_public_web("+12025550123")
        self.assertEqual(result["provider"], "Brave Search")
        self.assertEqual(result["status"], "provider_error")
        self.assertEqual(urlopen.call_count, 7)


if __name__ == "__main__":
    unittest.main()
