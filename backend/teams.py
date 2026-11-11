from sqlalchemy import delete, select, update
from sqlalchemy.dialects.sqlite import insert

from .db import accounts, team_seats, teams
from .domain import GameError


class Teams:
    def __init__(self, engine):
        self.engine = engine

    def create(self, player, key, name):
        name = name.strip()
        if not name:
            raise GameError("empty_name", 422)
        with self.engine.begin() as db:
            row = db.execute(insert(teams).values(id=key, name=name, owner=player).on_conflict_do_nothing())
            if row.rowcount:
                db.execute(insert(team_seats).values(team=key, player=player, joined=True))
            elif tuple(db.execute(select(teams.c.owner, teams.c.name).where(teams.c.id == key)).one()) != (player, name):
                raise GameError("team_conflict", 409)

    def overview(self, player):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            mine = db.execute(select(teams.c.id, teams.c.name, teams.c.owner, team_seats.c.joined)
                .join(team_seats).where(team_seats.c.player == player).order_by(teams.c.name, teams.c.id)).all()
            result = []
            for key, name, owner, joined in mine:
                members = []
                if joined:
                    members = db.execute(select(accounts.c.name, team_seats.c.joined).join(team_seats)
                        .where(team_seats.c.team == key, team_seats.c.joined | (owner == player))
                        .order_by(accounts.c.name)).mappings().all()
                result.append(dict(id=key, name=name, owner=owner == player, joined=joined,
                                   members=[dict(row) for row in members]))
            return result

    def invite(self, player, key, name):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            if not db.scalar(select(teams.c.id).where(teams.c.id == key, teams.c.owner == player)):
                raise GameError("team_unavailable", 404)
            target = db.scalar(select(accounts.c.player).where(accounts.c.name == name.strip()))
            if not target:
                raise GameError("unknown_player", 404)
            db.execute(insert(team_seats).values(team=key, player=target, joined=False).on_conflict_do_nothing())

    def respond(self, player, key, accept):
        with self.engine.begin() as db:
            seat = (team_seats.c.team == key) & (team_seats.c.player == player)
            if accept:
                if not db.execute(update(team_seats).where(seat).values(joined=True)).rowcount:
                    raise GameError("invitation_missing", 404)
            else:
                db.execute(delete(team_seats).where(seat, team_seats.c.joined.is_(False)))
