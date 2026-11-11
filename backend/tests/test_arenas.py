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

    def test_pairing_retries_expiry_and_final_draw(self):
        from concurrent.futures import ThreadPoolExecutor
        from backend.domain import GameError

        with TemporaryDirectory() as directory:
            app = create_app(Path(directory) / "games.db")
            with TestClient(app):
                state = app.state
                for name in ["Rook", "Bishop"]:
                    state.accounts.register(name, "test-password", name)
                arena = uuid4().hex
                service = state.arenas
                now = [1000]
                state.games.now_ms = lambda: now[0]
                service.create("Rook", arena, "Арена")
                with self.assertRaises(GameError):
                    service.control(arena, "Rook", "start", 0)
                service.register(arena, "Bishop", True)
                with self.assertRaises(GameError):
                    service.control(arena, "Bishop", "start", 0)
                service.control(arena, "Rook", "start", 0)
                # Start a game just before the arena closes.
                now[0] += 30 * 60000 - 1000
                with ThreadPoolExecutor(max_workers=2) as pool:
                    list(pool.map(lambda who: service.control(arena, who, "ready", 0), ["Rook", "Bishop"]))
                view = service.view(arena, "Rook")
                game = view["game"]
                self.assertEqual(view["played"], 1)
                service.control(arena, "Rook", "ready", 0)
                now[0] += 1000
                self.assertEqual(service.view(arena, "Bishop")["phase"], "finishing")
                with self.assertRaises(GameError):
                    service.control(arena, "Bishop", "ready", 1)
                state.games.apply(game, "Rook", "offer", 0, uuid4().hex)
                state.games.apply(game, "Bishop", "accept", 1, uuid4().hex)
                final = service.view(arena, None)
                self.assertEqual(final["phase"], "finished")
                self.assertEqual([r["points"] for r in final["standings"]], [1, 1])

    def test_existing_registration_remains_open_after_upgrade(self):
        from alembic import command
        from alembic.config import Config
        from sqlalchemy import create_engine, text

        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            engine = create_engine("sqlite:///" + str(path))
            config = Config()
            config.set_main_option("script_location", "backend/migrations")
            arena = uuid4().hex
            with engine.begin() as db:
                config.attributes["connection"] = db
                command.upgrade(config, "018_arenas")
                db.execute(text("INSERT INTO accounts(player,name,salt,password_hash) VALUES ('a','Rook',X'00',X'00')"))
                db.execute(text("INSERT INTO arenas(id,name,owner,created) VALUES (:id,'Блиц','a',0)"), {"id": arena})
                db.execute(text("INSERT INTO arena_members(arena,player) VALUES (:id,'a')"), {"id": arena})
            engine.dispose()
            with TestClient(create_app(path)) as guest:
                view = guest.get("/api/arenas/" + arena).json()
                self.assertEqual((view["phase"], view["players"]), ("registration", ["Rook"]))
