from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
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
