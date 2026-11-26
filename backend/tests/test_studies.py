from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.api import create_app


class StudyTest(TestCase):
    def test_validation_retry_and_public_link_after_restart(self):
        data = {"id": uuid4().hex, "name": "Центр", "side": "w",
                "lines": [[["e4", "Центр"], ["e5", ""]], [["d4", ""]]]}
        url = "/api/studies/" + data["id"]
        with TemporaryDirectory() as directory:
            path = Path(directory) / "game.db"
            with TestClient(create_app(path)) as client:
                for moves in ([["--", ""]], [["e4", ""], ["e4", ""]]):
                    self.assertEqual(client.post("/api/studies", json={**data, "lines": [moves]}).status_code, 422)
                self.assertEqual(client.get(url).status_code, 404)
                for _ in range(2):
                    self.assertEqual(client.post("/api/studies", json=data).json(), data)
                self.assertEqual(client.post("/api/studies", json={**data, "name": "copy"}).status_code, 409)
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get(url).json(), data)
