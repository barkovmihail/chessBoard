from sqlalchemy import case, insert, select, update

from .db import accounts, challenges
from .notifications import notify_challenge
from .domain import GameError


class Challenges:
    def __init__(self, games):
        self.games = games

    def pending(self, player):
        c = challenges.c
        opponent = case((c.sender == player, c.recipient), else_=c.sender)
        with self.games.engine.connect() as db:
            rows = db.execute(select(c.id, c.minutes, c.increment, accounts.c.name.label("opponent"),
                (c.recipient == player).label("incoming")).join(accounts, accounts.c.player == opponent)
                .where((c.sender == player) | (c.recipient == player), c.status == "pending",
                       c.expires > self.games.now_ms()).order_by(c.expires, c.id)).mappings()
            return [dict(row) for row in rows]

    def expired_incoming(self, player):
        c = challenges.c
        with self.games.engine.connect() as db:
            rows = db.execute(select(c.id, accounts.c.name.label("opponent"), c.minutes, c.increment)
                              .join(accounts, accounts.c.player == c.sender)
                              .where(c.recipient == player, c.status.in_(["pending", "expired"]),
                                     c.expires <= self.games.now_ms())
                              .order_by(c.expires.desc(), c.id.desc()).limit(10)).mappings()
            return [dict(row) for row in rows]

    def create(self, player, name, minutes, increment, challenge_id):
        c = challenges.c
        with self.games.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            recipient = db.scalar(select(accounts.c.player).where(accounts.c.name == name))
            if not recipient or recipient == player:
                raise GameError("invalid_opponent", 422)
            existing = db.execute(select(challenges).where(c.id == challenge_id)).mappings().first()
            if existing:
                if (existing["sender"], existing["recipient"], existing["minutes"], existing["increment"]) != (
                        player, recipient, minutes, increment):
                    raise GameError("command_conflict", 409)
                return {"id": challenge_id}
            now = self.games.now_ms()
            if db.scalar(select(c.id).where(c.sender == player, c.recipient == recipient, c.status == "pending",
                                            c.expires > now)):
                raise GameError("already_challenged", 409)
            db.execute(insert(challenges).values(id=challenge_id, sender=player, recipient=recipient,
                minutes=minutes, increment=increment, expires=now + 600000, status="pending"))
            notify_challenge(db, recipient, challenge_id, "challenge", now)
            return {"id": challenge_id}

    def respond(self, player, challenge_id, action):
        with self.games.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            row = db.execute(select(challenges).where(challenges.c.id == challenge_id)).mappings().first()
            if not row or row["sender" if action == "cancel" else "recipient"] != player:
                raise GameError("challenge_unavailable", 404)
            status, game = row["status"], row["game_id"]
            if status == "pending":
                if row["expires"] <= self.games.now_ms():
                    status = "expired"
                else:
                    status = {"cancel": "canceled", "decline": "declined", "accept": "accepted"}[action]
                    if action == "accept":
                        game = self.games.insert_game(db, row["sender"], True, (row["minutes"], row["increment"]),
                                                      guest=row["recipient"])
                    other = row["recipient"] if action == "cancel" else row["sender"]
                    notify_challenge(db, other, challenge_id, status, self.games.now_ms())
                db.execute(update(challenges).where(challenges.c.id == challenge_id).values(status=status, game_id=game))
            return {"status": status, "game_id": game}
