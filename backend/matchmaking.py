from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert

from .db import queue


class Matchmaking:
    def __init__(self, games):
        self.games = games

    @staticmethod
    def _view(row, now):
        if not row:
            return {"version": 0, "waiting": False, "game_id": None}
        return {"version": row["version"], "waiting": row["expires"] > now, "game_id": row["game_id"],
                "minutes": row["minutes"], "increment": row["increment"]}

    def status(self, player):
        with self.games.engine.connect() as db:
            row = db.execute(select(queue).where(queue.c.player == player)).mappings().first()
            return self._view(row, self.games.now_ms())

    def change(self, player, version, action, control=None):
        with self.games.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            now = self.games.now_ms()
            own = queue.c.player == player
            row = db.execute(select(queue).where(own)).mappings().first()
            current = self._view(row, now)
            if current["version"] != version:
                return current
            if action == "start" and not current["waiting"]:
                minutes, increment = control
                rival = db.execute(select(queue.c.player).where(queue.c.player != player, queue.c.expires > now,
                    queue.c.minutes == minutes, queue.c.increment == increment)
                    .order_by(queue.c.started, queue.c.player).limit(1)).scalar()
                game_id = None
                if rival:
                    game_id = self.games.insert_game(db, rival, True, control, player)
                    db.execute(update(queue).where(queue.c.player == rival).values(
                        expires=0, game_id=game_id, version=queue.c.version + 1))
                values = dict(version=version + 1, minutes=minutes, increment=increment, started=now,
                              expires=0 if rival else now + 90000, game_id=game_id)
                db.execute(insert(queue).values(player=player, **values).on_conflict_do_update(
                    index_elements=["player"], set_=values))
            elif current["waiting"] and action in ("cancel", "renew"):
                db.execute(update(queue).where(own).values(expires=0 if action == "cancel" else now + 90000,
                           version=version + (action == "cancel")))
            return self._view(db.execute(select(queue).where(own)).mappings().first(), now)
