from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient
from backend.api import create_app


class TeamsTest(TestCase):
    def test_private_invite_repeat_decline_and_accept(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            key = uuid4().hex
            url = "/api/teams/" + key
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get("/api/teams").status_code, 403)
                cookies = {}
                for name in ("King", "Rook", "Pawn"):
                    client.cookies.clear()
                    client.post("/api/account/register", json={"name": name, "password": "test-password"}).raise_for_status()
                    cookies[name] = client.cookies.get("player")
                client.cookies.set("player", cookies["King"], domain="testserver.local", path="/")
                for _ in range(2):
                    client.post("/api/teams", json={"id": key, "name": "Клуб"}).raise_for_status()
                    client.post(url + "/invite", json={"name": "rook"}).raise_for_status()
                client.cookies.set("player", cookies["Pawn"], domain="testserver.local", path="/")
                self.assertEqual(client.get("/api/teams").json(), [])
                self.assertEqual(client.post(url + "/accept").status_code, 404)
                self.assertEqual(client.post(url + "/invite", json={"name": "Pawn"}).status_code, 404)
                client.cookies.set("player", cookies["Rook"], domain="testserver.local", path="/")
                client.post(url + "/decline").raise_for_status()
                self.assertEqual(client.get("/api/teams").json(), [])
                client.cookies.set("player", cookies["King"], domain="testserver.local", path="/")
                client.post(url + "/invite", json={"name": "Rook"}).raise_for_status()
            with TestClient(create_app(path)) as client:
                client.cookies.set("player", cookies["Rook"])
                for _ in range(2):
                    client.post(url + "/accept").raise_for_status()
                team, = client.get("/api/teams").json()
                self.assertEqual([p["name"] for p in team["members"]], ["King", "Rook"])
