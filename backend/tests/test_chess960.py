import io
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

import chess.pgn
from fastapi.testclient import TestClient
from backend.api import create_app


class Chess960Test(TestCase):
    def test_castle_review_export_and_persistence(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "db"
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.post("/api/games", json={"chess960": 960}).status_code, 422)
                initial = client.post("/api/games", json={"chess960": 3, "public": True, "online": True}).json()
                url = "/api/games/" + initial["id"]
                white = client.cookies.get("player")
                client.cookies.clear()
                client.post(url + "/join").raise_for_status()
                black = client.cookies.get("player")
                client.cookies.clear()
                client.cookies.set("player", white)
                client.post(url + "/moves", json=dict(uci="f1g1", version=0, command_id=uuid4().hex)).raise_for_status()
                client.cookies.clear()
                client.cookies.set("player", black)
                result = client.post(url + "/actions", json=dict(action="resign", version=1, command_id=uuid4().hex)).json()
                self.assertEqual(result["moves"], ["O-O"])
                game = chess.pgn.read_game(io.StringIO(result["review960"]["pgn"]))
                self.assertEqual(game.board().chess960_pos(), 3)
                self.assertEqual(list(game.mainline_moves()), [chess.Move.from_uci("f1g1")])
            with TestClient(create_app(path)) as client:
                client.cookies.set("player", white)
                self.assertEqual(client.get(url).json()["review960"], result["review960"])
                watch = client.get("/api/watch/" + initial["watch_key"]).json()
                self.assertEqual(watch["notation"], ["O-O"])
