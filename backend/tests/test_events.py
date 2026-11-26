from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from backend.api import create_app


class GameEventsTest(TestCase):
    def test_access_join_move_and_reconnect(self):
        with TemporaryDirectory() as directory, TestClient(create_app(Path(directory) / "games.db")) as api:
            game = api.post("/api/games", json={"online": True}).json()
            url = "/api/games/" + game["id"]
            origin = {"Origin": "http://testserver"}
            for headers in [{"Origin": "https://other"}, {**origin, "Cookie": "player=stranger"}]:
                with self.assertRaises(WebSocketDisconnect), api.websocket_connect(url + "/events", headers=headers):
                    self.fail("unauthorized subscription")
            with api.websocket_connect(url + "/events", headers=origin) as host:
                self.assertEqual(host.receive_json(), {"type": "snapshot", "game": game})
                guest_headers = {**origin, "Cookie": "player=guest"}
                host_cookie = api.cookies["player"]
                api.post(url + "/join", headers=guest_headers).raise_for_status()
                self.assertFalse(host.receive_json()["game"]["waiting"])
                with api.websocket_connect(url + "/events", headers=guest_headers) as guest:
                    self.assertEqual(guest.receive_json()["game"]["side"], "black")
                    api.post(url + "/moves", headers={"Cookie": f"player={host_cookie}"},
                             json={"uci": "e2e4", "version": 0, "command_id": str(uuid4())}).raise_for_status()
                    self.assertEqual(guest.receive_json()["game"]["moves"], ["e4"])
                    self.assertEqual(host.receive_json()["game"]["side"], "white")
            with api.websocket_connect(url + "/events", headers=guest_headers) as resumed:
                self.assertEqual(resumed.receive_json()["game"]["version"], 1)
