from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

import chess
from fastapi.testclient import TestClient
from sqlalchemy import select

from backend.api import create_app
from backend.db import opening_positions


class OpeningPositionTest(TestCase):
    def test_snapshot_is_private_idempotent_and_survives_restart(self):
        board = chess.Board()
        board.push_san("e4")
        position = dict(chapter="french-defense", line=0, ply=1, fen=board.fen(), side="b", expected="e7e6")
        url = "/api/openings/positions"
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            with TestClient(create_app(path)) as guest:
                guest.post(url, json=position).raise_for_status()
                guest.post(url, json=position).raise_for_status()
                self.assertEqual(guest.post(url, json={**position, "side": "w"}).status_code, 422)
                self.assertEqual(guest.post(url, json={**position, "expected": "e7e4"}).status_code, 422)
                cookie = guest.cookies.get("player")
            with TestClient(create_app(path)) as other:
                self.assertEqual(other.get(url).json(), {"position": None, "more": False})
                other.cookies.set("player", cookie)
                self.assertEqual(other.get(url).json(), {"position": {**position, "chapter_name": None}, "more": False})
                other.post(url, json={**position, "line": 1}).raise_for_status()
                self.assertTrue(other.get(url).json()["more"])
                self.assertEqual(other.get(url, params={"offset": 1}).json()["position"]["line"], 1)
                other.cookies.clear()
                other.post(url, json=position).raise_for_status()
                with other.app.state.games.engine.connect() as db:
                    rows = db.execute(select(opening_positions).where(opening_positions.c.line == 0)).mappings().all()
                self.assertEqual(len(rows), 2)
                self.assertNotEqual(rows[0]["player"], rows[1]["player"])
                for row in rows:
                    self.assertEqual({key: row[key] for key in position}, position)
