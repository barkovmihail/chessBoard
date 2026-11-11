from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4
from fastapi.testclient import TestClient
from sqlalchemy import update
from backend.api import create_app
from backend.db import accounts


class ChatTest(TestCase):
    def test_visibility_preferences_and_moderation(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "db"
            app = create_app(path)
            with TestClient(app) as c:
                cookies = {}
                for who in ("King", "Rook", "Mod"):
                    c.cookies.clear()
                    c.post("/api/account/register", json=dict(name=who, password="test-password")).raise_for_status()
                    cookies[who] = c.cookies.get("player")

                def login(who):
                    c.cookies.clear()
                    c.cookies.set("player", cookies[who])

                login("King")
                post = dict(token=uuid4().hex, body="Привет")
                for _ in range(2):
                    c.post("/api/chat/messages", json=post).raise_for_status()
                c.cookies.clear()
                message, = c.get("/api/chat").json()["messages"]
                self.assertEqual(c.post("/api/chat/messages", json=post).status_code, 403)
                seq = message["seq"]
                login("Rook")
                c.post("/api/chat/authors/block", json=dict(name="King")).raise_for_status()
                self.assertFalse(c.get("/api/chat").json()["messages"])
                c.post("/api/chat/authors/unblock", json=dict(name="King")).raise_for_status()
                for _ in range(2):
                    c.post(f"/api/chat/messages/{seq}/report").raise_for_status()
                self.assertFalse(c.get("/api/chat").json()["queue"])
                self.assertEqual(c.post(f"/api/chat/reports/{seq}/hide").status_code, 403)
                c.post("/api/chat/preferences/mute").raise_for_status()
                with app.state.chat.engine.begin() as db:
                    db.execute(update(accounts).where(accounts.c.name == "Mod").values(chat_moderator=True))
                login("Mod")
                report, = c.get("/api/chat").json()["queue"]
                self.assertEqual(report["count"], 1)
                c.post(f"/api/chat/reports/{seq}/hide").raise_for_status()
                self.assertFalse(c.get("/api/chat").json()["queue"])
            with TestClient(create_app(path)) as c:
                self.assertFalse(c.get("/api/chat").json()["messages"])
                c.cookies.set("player", cookies["Rook"])
                self.assertTrue(c.get("/api/chat").json()["muted"])
