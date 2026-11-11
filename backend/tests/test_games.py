from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.api import create_app


class SavedGameTest(TestCase):
    def test_move_retry_restart_and_access(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.sqlite3"
            with TestClient(create_app(path)) as client:
                game = client.post("/api/games").json()
                url = "/api/games/" + game["id"]
                token = client.cookies["player"]

                def command(uci):
                    return {"uci": uci, "version": 0, "command_id": str(uuid4())}

                self.assertEqual(client.post(url + "/moves", json=command("e2e5")).status_code, 422)
                self.assertEqual(client.get(url).json(), game)
                move = command("e2e4")
                expected = client.post(url + "/moves", json=move).json()
                self.assertEqual(client.post(url + "/moves", json=move).json(), expected)
                self.assertEqual(expected["moves"], ["e4"])
                self.assertEqual(expected["turn"], "black")
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get(url).status_code, 404)
                client.cookies.set("player", token)
                self.assertEqual(client.get(url).json(), expected)
                self.assertIn({"color": "white", "type": "pawn", "square": "e4"}, expected["position"])
                def reply(uci):
                    return client.post(url + "/moves", json={**command(uci), "version": 1}).status_code
                with ThreadPoolExecutor(2) as pool:
                    self.assertEqual(sorted(pool.map(reply, ["e7e5", "c7c5"])), [200, 409])
                self.assertEqual(client.get(url).json()["version"], 2)
