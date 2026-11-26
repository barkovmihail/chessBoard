from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from fastapi.testclient import TestClient
from backend.api import create_app


class AccountTest(TestCase):
    def test_guest_upgrade_login_restart_and_revocation(self):
        credentials = {"name": "Knight", "password": "test-password"}
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            with TestClient(create_app(path)) as client:
                game = client.post("/api/games").json()
                url = "/api/games/" + game["id"]
                guest = client.cookies["player"]
                client.post("/api/account/register", json=credentials).raise_for_status()
                first = client.cookies["player"]
                self.assertEqual(client.get(url, headers={"Cookie": "player=" + guest}).status_code, 404)
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.post("/api/account/register", json=credentials).status_code, 409)
                self.assertEqual(client.post("/api/account/login", json={**credentials, "password": "bad-password"}).status_code, 401)
                client.post("/api/account/login", json=credentials).raise_for_status()
                second = client.cookies["player"]
                self.assertNotEqual(first, second)
                self.assertEqual(client.get(url).json()["id"], game["id"])
                client.post("/api/account/logout").raise_for_status()
                self.assertEqual(client.get(url, headers={"Cookie": "player=" + second}).status_code, 404)
                self.assertEqual(client.get(url, headers={"Cookie": "player=" + first}).status_code, 200)
