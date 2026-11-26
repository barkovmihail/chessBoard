import sqlite3
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from unittest.mock import patch
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.api import create_app


class AttemptTest(TestCase):
    def test_retries_privacy_restart_and_account_upgrade(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            progress = dict(id=str(uuid4()), puzzle="abc12", mistakes=1, solved=False)
            url = "/api/puzzles/attempts"
            with TestClient(create_app(path)) as client:
                client.post(url, json=progress).raise_for_status()
                client.post(url, json={**progress, "solved": True}).raise_for_status()
                client.post(url, json={**progress, "mistakes": 0}).raise_for_status()
                self.assertEqual(client.post(url, json={**progress, "puzzle": "other"}).status_code, 409)
                creds = {"name": "Trainer", "password": "example-password"}
                client.post("/api/account/register", json=creds).raise_for_status()
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get(url).json()["items"], [])
                client.post("/api/account/login", json=creds).raise_for_status()
                row, = client.get(url).json()["items"]
                self.assertEqual((row["mistakes"], row["solved"]), (1, True))

    def test_progress_counts_distinct_puzzles_and_original_first_try(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            catalogue = sqlite3.connect(path.with_name("puzzles.sqlite3"))
            catalogue.execute("CREATE TABLE puzzles(puzzle_id TEXT PRIMARY KEY, themes TEXT)")
            catalogue.executemany("INSERT INTO puzzles VALUES (?,?)", [("a", "fork pin"), ("b", "fork"), ("c", "pin")])
            catalogue.commit()
            catalogue.close()
            with TestClient(create_app(path)) as client, patch("backend.puzzle_attempts.time_ns") as now:
                def attempt(puzzle, mistakes, solved):
                    client.post("/api/puzzles/attempts", json=dict(id=str(uuid4()), puzzle=puzzle,
                                mistakes=mistakes, solved=solved)).raise_for_status()
                now.return_value = 86400 * 10**9
                attempt("a", 2, False)
                now.return_value *= 20
                attempt("a", 0, True)
                attempt("b", 0, True)
                attempt("c", 2, False)
                url = "/api/profile/puzzle-progress"
                short = client.get(url, params={"days": 7}).json()
                self.assertEqual(short, {"practiced": 3, "solved": 2, "first": 1,
                    "themes": {"fork": {"solved": 2, "mistakes": 0}, "pin": {"solved": 1, "mistakes": 2}}})
                self.assertEqual(client.get(url).json()["themes"]["pin"]["mistakes"], 4)
                client.cookies.clear()
                self.assertEqual(client.get(url).json()["practiced"], 0)
