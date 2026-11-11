from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.api import create_app


class WatchTest(TestCase):
    def test_separate_keys_privacy_and_restart(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            with TestClient(create_app(path)) as owner:
                private = owner.post("/api/games", json={}).json()
                self.assertIsNone(private["watch_key"])
                game = owner.post("/api/games", json={"public": True, "online": True}).json()
            with TestClient(create_app(path)) as visitor:
                for key in (private["id"], game["id"]):
                    self.assertEqual(visitor.get("/api/watch/" + key).status_code, 404)
                url = "/api/watch/" + game["watch_key"]
                view = visitor.get(url).json()
                self.assertEqual(set(view), {"version", "moves", "waiting", "result", "reason"})
                self.assertTrue(view["waiting"])
                self.assertEqual(visitor.post("/api/games/" + game["watch_key"] + "/join").status_code, 404)
                command = {"uci": "e2e4", "command_id": str(uuid4()), "version": 0}
                self.assertEqual(visitor.post("/api/games/" + game["id"] + "/moves", json=command).status_code, 404)
