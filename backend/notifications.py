from sqlalchemy import case, func, insert, select, update

from .db import accounts, challenges, notifications


def notify_challenge(db, player, challenge_id, kind, now):
    setting = accounts.c.notify_challenge if kind == "challenge" else accounts.c.notify_response
    if db.scalar(select(setting).where(accounts.c.player == player)):
        db.execute(insert(notifications).values(player=player, challenge_id=challenge_id, kind=kind, created=now))


class Notifications:
    def __init__(self, engine):
        self.engine = engine

    def feed(self, player, before=None):
        n, c = notifications.c, challenges.c
        rival = case((c.sender == player, c.recipient), else_=c.sender)
        query = select(n.id, n.kind, n.created, n.seen, c.game_id, accounts.c.name.label("opponent")).select_from(
            notifications.join(challenges).join(accounts, accounts.c.player == rival)).where(n.player == player)
        if before is not None:
            query = query.where(n.id < before)
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            unread = db.scalar(select(func.count()).select_from(notifications).where(n.player == player, ~n.seen))
            rows = db.execute(query.order_by(n.id.desc()).limit(21)).mappings().all()
        return {"unread": unread, "items": [dict(row) for row in rows[:20]],
                "before": rows[19]["id"] if len(rows) > 20 else None}

    def read(self, player, item):
        query = update(notifications).where(notifications.c.player == player)
        if item is not None:
            query = query.where(notifications.c.id == item)
        with self.engine.begin() as db:
            db.execute(query.values(seen=True))

    def preferences(self, player, changes=None):
        with self.engine.begin() as db:
            if changes:
                db.execute(update(accounts).where(accounts.c.player == player).values(**changes))
            return dict(db.execute(select(accounts.c.notify_challenge, accounts.c.notify_response)
                .where(accounts.c.player == player)).mappings().one())
