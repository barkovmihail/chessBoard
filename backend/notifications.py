from sqlalchemy import case, func, insert, select, update

from .db import accounts, challenges, games, notifications


def notify_challenge(db, player, challenge_id, kind, now):
    setting = accounts.c.notify_challenge if kind == "challenge" else accounts.c.notify_response
    if db.scalar(select(setting).where(accounts.c.player == player)):
        db.execute(insert(notifications).values(player=player, challenge_id=challenge_id, kind=kind, created=now))


def notify_turn(db, player, game_id, ply, now):
    if db.scalar(select(accounts.c.notify_turn).where(accounts.c.player == player)):
        db.execute(insert(notifications).values(player=player, game_id=game_id, ply=ply, kind="turn", created=now))


def notify_finish(db, game, now):
    players = db.scalars(select(accounts.c.player).where(accounts.c.player.in_([game["owner"], game["guest"]]),
                                                        accounts.c.notify_finish)).all()
    for player in players:
        db.execute(insert(notifications).values(player=player, game_id=game["id"], ply=0, kind="finish", created=now))


class Notifications:
    def __init__(self, engine):
        self.engine = engine

    def feed(self, player, before=None):
        n, c = notifications.c, challenges.c
        g = games.c
        rival = case((n.challenge_id.is_not(None), case((c.sender == player, c.recipient), else_=c.sender)),
                     (g.owner == player, g.guest), else_=g.owner)
        opponent = func.coalesce(accounts.c.name, case((g.online.is_(False), "На одном устройстве"), else_="Гость"))
        query = select(n.id, n.kind, n.created, n.seen, func.coalesce(n.game_id, c.game_id).label("game_id"),
                       opponent.label("opponent"), case((n.kind == "finish", g.result)).label("result")).select_from(
            notifications.outerjoin(challenges, c.id == n.challenge_id).outerjoin(games, g.id == n.game_id)
            .outerjoin(accounts, accounts.c.player == rival)).where(n.player == player)
        if before is not None:
            query = query.where(n.id < before)
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            sound = db.scalar(select(accounts.c.notify_sound).where(accounts.c.player == player))
            unread = db.scalar(select(func.count()).select_from(notifications).where(n.player == player, ~n.seen))
            rows = db.execute(query.order_by(n.id.desc()).limit(21)).mappings().all()
        return {"sound": bool(sound), "unread": unread, "items": [dict(row) for row in rows[:20]],
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
            return dict(db.execute(select(accounts.c.notify_challenge, accounts.c.notify_response,
                                          accounts.c.notify_turn, accounts.c.notify_finish, accounts.c.notify_sound)
                .where(accounts.c.player == player)).mappings().one())
