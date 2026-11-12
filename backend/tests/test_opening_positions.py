from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch

import chess
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, insert, select, text, update

from backend.api import create_app
from backend.db import open_database, opening_positions, study_chapters
from backend.opening_positions import review_position


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
                self.assertEqual(other.get(url).json(), {"position": {**position, "chapter_name": None, "due_at": 0}, "more": False})
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

    def test_schedule_survives_restart_and_uses_first_answer(self):
        position = dict(chapter="italian-game", line=0, ply=0, fen=chess.STARTING_FEN, side="w", expected="e2e4")
        url = "/api/openings/positions"
        with TemporaryDirectory() as directory, patch("backend.opening_positions.time") as clock:
            path = Path(directory) / "games.db"
            clock.return_value = 1000
            with TestClient(create_app(path)) as client:
                client.post(url, json=position).raise_for_status()
                cookie = client.cookies.get("player")
                def answer(correct, due):
                    response = client.post("/api/openings/review", json={**position, "due_at": due, "correct": correct})
                    response.raise_for_status()
                    return response.json()["due_at"]
                self.assertEqual(answer(False, 0), 1600)
                self.assertEqual(answer(True, 0), 1600)
                self.assertIsNone(client.get(url).json()["position"])
                clock.return_value = 1600
                self.assertEqual(client.get(url).json()["position"]["due_at"], 1600)
                due = answer(True, 1600)
                self.assertEqual(due, 1600 + 86400)
                clock.return_value = due
                self.assertEqual(answer(True, due), due + 2 * 86400)
            with TestClient(create_app(path)) as client:
                command = {**position, "due_at": due, "correct": False}
                self.assertEqual(client.post("/api/openings/review", json=command).status_code, 404)
                client.cookies.set("player", cookie)
                self.assertIsNone(client.get(url).json()["position"])
                clock.return_value = due + 2 * 86400
                self.assertEqual(client.get(url).json()["position"]["due_at"], clock.return_value)

    def test_legacy_position_is_due_even_if_the_chapter_changes(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "old.db"
            engine = create_engine("sqlite:///" + str(path))
            config = Config()
            config.set_main_option("script_location", "backend/migrations")
            with engine.begin() as db:
                config.attributes["connection"] = db
                command.upgrade(config, "027_opening_positions")
                db.execute(insert(study_chapters).values(id="chapter", name="Center", side="w", lines=[[["e4", ""]]]))
                db.execute(text("INSERT INTO opening_positions(player,chapter,line,ply,fen,side,expected) "
                                "VALUES ('guest','chapter',0,0,:fen,'w','e2e4')"), {"fen": chess.STARTING_FEN})
            engine.dispose()
            engine = open_database(path)
            try:
                with engine.begin() as db:
                    db.execute(update(study_chapters).values(lines=[[["d4", ""]]]))
                saved = review_position(engine, "guest", 0)["position"]
                self.assertEqual((saved["due_at"], saved["expected"], saved["chapter_name"]), (0, "e2e4", "Center"))
            finally:
                engine.dispose()
