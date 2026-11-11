from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.api import create_app


class ArenaTest(TestCase):
    def test_registration_survives_restart(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            arena = dict(id=uuid4().hex, name="Блиц")
            url = "/api/arenas/" + arena["id"]
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.post("/api/arenas", json=arena).status_code, 403)
                client.post("/api/account/register", json=dict(name="Rook", password="test-password")).raise_for_status()
                for _ in range(2):
                    client.post("/api/arenas", json=arena).raise_for_status()
                client.post(url + "/leave").raise_for_status()
                self.assertEqual(client.get(url).json()["players"], [])
                for _ in range(2):
                    client.post(url + "/join").raise_for_status()
            with TestClient(create_app(path)) as guest:
                view = guest.get(url).json()
                self.assertEqual(view["players"], ["Rook"])
                self.assertFalse(view["joined"])
                self.assertEqual(guest.get("/api/arenas").json()["items"], [arena])
