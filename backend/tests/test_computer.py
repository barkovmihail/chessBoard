from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

import chess
from fastapi.testclient import TestClient

from backend.api import create_app
from backend.computer import SEATS
from backend.db import open_database
from backend.domain import GameError
from backend.service import Games


class ComputerGameTest(TestCase):
    def test_serverless_move_includes_computer_reply_once(self):
        with TemporaryDirectory() as directory, patch.dict("os.environ", VERCEL="1"):
            app = create_app(Path(directory) / "games.db")
            with TestClient(app) as client, patch("backend.api.executable", return_value="stockfish"), \
                    patch("backend.computer.chess.engine.SimpleEngine.popen_uci") as launch:
                engine = launch.return_value.__enter__.return_value
                engine.play.return_value.move = chess.Move.from_uci("e7e5")
                game = client.post("/api/games", json={"engine_name": "stockfish", "engine_level": "easy"}).json()
                url = "/api/games/" + game["id"]
                command = {"uci": "e2e4", "version": 0, "command_id": str(uuid4())}
                for _ in range(2):
                    view = client.post(url + "/moves", json=command).json()
                    self.assertEqual(view["moves"], ["e4", "e5"])
                    self.assertEqual(view["side"], "white")
                    self.assertEqual(view["turn"], "white")
                self.assertEqual(client.get(url).json()["version"], 2)
                engine.play.assert_called_once()

    def test_seats_restart_and_archive(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            db = open_database(path)
            games = Games(db)
            game_id = games.create("human", control=(10, 5), engine_level="normal")["id"]
            games.apply(game_id, "human", "e2e4", 0, uuid4().hex)
            db.dispose()
            db = open_database(path)
            try:
                games = Games(db)
                self.assertEqual(games.get(game_id, "human")["engine_level"], "normal")
                with self.assertRaises(GameError):
                    games.apply(game_id, "human", "e7e5", 1, uuid4().hex)
                games.apply(game_id, SEATS["lc0"], "e7e5", 1, uuid4().hex)
                games.apply(game_id, "human", "resign", 2, uuid4().hex)
                self.assertEqual(games.archive("human", 0, 20)["items"][0]["opponent"], "Leela Chess Zero")
            finally:
                db.dispose()
