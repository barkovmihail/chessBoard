from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase
from uuid import uuid4

from fastapi.testclient import TestClient

from backend.api import create_app


class PrivateMessagesTest(TestCase):
    def test_access_retry_pagination_and_restart(self):
        url = "/api/private-messages"
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            cookies = {}
            post = {"body": "Private line", "recipient": "rook", "token": uuid4().hex}
            with TestClient(create_app(path)) as client:
                self.assertEqual(client.get(url).status_code, 403)
                self.assertEqual(client.post(url, json=post).status_code, 403)
                for name in ("Rook", "Pawn", "King"):
                    client.cookies.clear()
                    client.post("/api/account/register", json={"name": name, "password": "test-password"}).raise_for_status()
                    cookies[name] = client.cookies.get("player")
                for name in ("King", "Unknown"):
                    self.assertEqual(client.post(url, json={**post, "recipient": name}).status_code, 422)
                self.assertEqual(client.post(url, json={**post, "body": " "}).status_code, 422)
                for _ in range(2):
                    client.post(url, json=post).raise_for_status()
                self.assertEqual(client.post(url, json={**post, "body": "Changed"}).status_code, 409)
                sent, = client.get(url).json()["items"]
                self.assertTrue(sent["outgoing"])
                for i in range(20):
                    client.post(url, json={**post, "token": uuid4().hex, "body": str(i)}).raise_for_status()
            with TestClient(create_app(path)) as client:
                client.cookies.set("player", cookies["Pawn"])
                self.assertEqual(client.get(url).json(), {"items": [], "before": None})
                client.cookies.clear()
                client.cookies.set("player", cookies["Rook"])
                first = client.get(url).json()
                self.assertEqual(len(first["items"]), 20)
                older = client.get(url, params={"before": first["before"]}).json()
                self.assertEqual(older, {"items": [{**sent, "outgoing": False}], "before": None})
                self.assertEqual(client.get("/api/chat").json()["messages"], [])
