from secrets import randbelow

from sqlalchemy import select, update
from sqlalchemy.dialects.sqlite import insert

from .db import accounts, queue
from .domain import GameError


class Matchmaking:
    def __init__(self, games):
        self.games = games

    @staticmethod
    def _view(row, now):
        if not row:
            return {"version": 0, "waiting": False, "game_id": None}
        return {"version": row["version"], "waiting": row["expires"] > now, "game_id": row["game_id"],
                "chess960": row["chess960"], "rated": row["rated"], "minutes": row["minutes"], "increment": row["increment"]}

    def status(self, player):
        with self.games.engine.connect() as db:
            row = db.execute(select(queue).where(queue.c.player == player)).mappings().first()
            return self._view(row, self.games.now_ms())

    def change(self, player, version, action, control=None, rated=False, chess960=False):
        with self.games.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            now = self.games.now_ms()
            own = queue.c.player == player
            row = db.execute(select(queue).where(own)).mappings().first()
            current = self._view(row, now)
            if current["version"] != version:
                return current
            if action == "start" and not current["waiting"]:
                if rated and chess960:
                    raise GameError("variant_unrated", 422)
                if rated and not db.scalar(select(accounts.c.player).where(accounts.c.player == player)):
                    raise GameError("account_required", 403)
                minutes, increment = control
                rival = db.execute(select(queue.c.player).where(queue.c.player != player, queue.c.expires > now,
                    queue.c.chess960 == chess960, queue.c.rated == rated, queue.c.minutes == minutes, queue.c.increment == increment)
                    .order_by(queue.c.started, queue.c.player).limit(1)).scalar()
                game_id = None
                if rival:
                    game_id = self.games.insert_game(db, rival, True, control, player, rated=rated,
                                                     chess960=randbelow(960) if chess960 else None)
                    db.execute(update(queue).where(queue.c.player == rival).values(
                        expires=0, game_id=game_id, version=queue.c.version + 1))
                values = dict(chess960=chess960, rated=rated, version=version + 1, minutes=minutes, increment=increment, started=now,
                              expires=0 if rival else now + 90000, game_id=game_id)
                db.execute(insert(queue).values(player=player, **values).on_conflict_do_update(
                    index_elements=["player"], set_=values))
            elif current["waiting"] and action in ("cancel", "renew"):
                db.execute(update(queue).where(own).values(expires=0 if action == "cancel" else now + 90000,
                           version=version + (action == "cancel")))
            return self._view(db.execute(select(queue).where(own)).mappings().first(), now)
