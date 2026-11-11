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

    def test_block_removes_only_pending_invitations_from_sender(self):
        from backend.domain import GameError
        with TemporaryDirectory() as directory:
            app = create_app(Path(directory) / "games.db")
            with TestClient(app):
                teams = app.state.teams
                for name in ("White", "Black", "Other"):
                    app.state.accounts.register(name, "test-password", name)
                for team, owner in [("old", "White"), ("pending", "White"), ("other", "Other")]:
                    teams.create(owner, team, team)
                    teams.invite(owner, team, "Black")
                teams.respond("Black", "old", True)
                teams.block("Black", "white", True)
                self.assertEqual(teams.blocked("Black"), ["White"])
                self.assertEqual({t["id"] for t in teams.overview("Black")}, {"old", "other"})
                with self.assertRaises(GameError):
                    teams.invite("White", "pending", "Black")
                with self.assertRaises(GameError):
                    teams.respond("Black", "pending", True)
                teams.block("Black", "White", False)
                self.assertEqual(teams.blocked("Black"), [])
                teams.invite("White", "pending", "Black")
                teams.respond("Black", "pending", True)
