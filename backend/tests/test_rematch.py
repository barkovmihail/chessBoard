from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest import TestCase

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, text

from backend.db import open_database
from backend.domain import GameError
from backend.service import Games


class RematchTest(TestCase):
    def test_existing_game_migration_and_concurrent_acceptance(self):
        with TemporaryDirectory() as directory:
            path = Path(directory) / "games.db"
            old = create_engine("sqlite:///" + str(path))
            config = Config()
            config.set_main_option("script_location", "backend/migrations")
            with old.begin() as db:
                config.attributes["connection"] = db
                command.upgrade(config, "004_clocks")
                db.execute(text("INSERT INTO games (id, owner, guest, online, version) VALUES ('old','a','b',1,0)"))
                db.execute(text("INSERT INTO games (id,owner,version) VALUES ('mate','solo',4)"))
                for ply, uci in enumerate(("f2f3", "e7e5", "g2g4", "d8h4"), 1):
                    db.execute(text("INSERT INTO moves (game_id,ply,uci,command_id) VALUES ('mate',:ply,:uci,:uci)"),
                               {"ply": ply, "uci": uci})
            old.dispose()
            engine = open_database(path)
            service = Games(engine)
            self.assertIsNone(service.get("old", "a")["watch_key"])
            entry, = service.archive("solo", 0, 20)["items"]
            self.assertEqual((entry["result"], entry["reason"], entry["finished_ms"]), ("0-1", "checkmate", None))
            def apply(player, action, version, key):
                return service.apply("old", player, action, version, key)
            with self.assertRaises(GameError):
                apply("a", "rematch", 0, "early")
            apply("a", "resign", 0, "end")
            apply("a", "rematch", 1, "offer")
            with self.assertRaises(GameError):
                apply("a", "rematch", 2, "self")
            with self.assertRaises(GameError):
                apply("c", "rematch", 2, "stranger")
            with ThreadPoolExecutor(2) as pool:
                accepted = list(pool.map(lambda _: apply("b", "rematch", 2, "accept"), range(2)))
            self.assertEqual(accepted[0], accepted[1])
            with engine.connect() as db:
                self.assertEqual(db.scalar(text("SELECT count(*) FROM games")), 3)
            engine.dispose()
            reopened = open_database(path)
            next_game = Games(reopened).get(accepted[0]["next_game"], "b")
            self.assertEqual((next_game["side"], next_game["previous_game"]), ("white", "old"))
            self.assertNotIn("clock", next_game)
            reopened.dispose()
