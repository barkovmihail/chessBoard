from time import time_ns

from sqlalchemy import delete, func, select, update
from sqlalchemy.dialects.sqlite import insert

from .db import accounts, arena_members, arenas, games
from .domain import GameError


class Arenas:
    def __init__(self, games):
        self.games = games
        self.engine = games.engine

    def create(self, player, arena_id, name):
        name = name.strip()
        if not name:
            raise GameError("empty_name", 422)
        with self.engine.begin() as db:
            result = db.execute(insert(arenas).values(id=arena_id, name=name, owner=player,
                created=time_ns() // 1_000_000).on_conflict_do_nothing())
            if result.rowcount:
                db.execute(insert(arena_members).values(arena=arena_id, player=player))
            else:
                row = db.execute(select(arenas.c.owner, arenas.c.name).where(arenas.c.id == arena_id)).one()
                if tuple(row) != (player, name):
                    raise GameError("arena_conflict", 409)
        return {"id": arena_id}

    def listing(self, offset):
        with self.engine.connect() as db:
            rows = db.execute(select(arenas.c.id, arenas.c.name).order_by(arenas.c.created.desc(), arenas.c.id)
                              .offset(offset).limit(21)).mappings().all()
        return {"items": [dict(row) for row in rows[:20]], "more": len(rows) > 20}

    def view(self, arena_id, player):
        with self.engine.connect() as db:
            db.exec_driver_sql("BEGIN")
            row = db.execute(select(arenas).where(arenas.c.id == arena_id)).mappings().first()
            if not row:
                raise GameError("arena_missing", 404)
            entrants = db.execute(select(accounts.c.name, accounts.c.player, arena_members.c.ready)
                .join(arena_members, arena_members.c.player == accounts.c.player)
                .where(arena_members.c.arena == arena_id).order_by(accounts.c.name)).all()
            scores = {user: 0 for _, user, _ in entrants}
            active = None
            played = 0
            unfinished = False
            for match in db.execute(select(games.c.id, games.c.owner, games.c.guest, games.c.result)
                                    .where(games.c.arena_id == arena_id)):
                if player in (match.owner, match.guest):
                    played += 1
                    if match.result is None:
                        active = match.id
                if match.result is None:
                    unfinished = True
                elif match.result == "1/2-1/2":
                    scores[match.owner] += 1
                    scores[match.guest] += 1
                else:
                    scores[match.owner if match.result == "1-0" else match.guest] += 2
            phase = "registration"
            if row["ends"] is not None:
                phase = "playing" if row["ends"] > self.games.now_ms() else ("finishing" if unfinished else "finished")
            standings = sorted(({"name": name, "points": scores[user]} for name, user, _ in entrants),
                               key=lambda item: (-item["points"], item["name"].casefold()))
            return {"name": row["name"], "owner": row["owner"] == player, "signed_in": bool(player),
                    "joined": player in scores, "players": [name for name, _, _ in entrants],
                    "phase": phase, "ends": row["ends"], "game": active, "played": played, "standings": standings,
                    "ready": any(user == player and ready is not None for _, user, ready in entrants)}

    def register(self, arena_id, player, join):
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            if not db.scalar(select(arenas.c.id).where(arenas.c.id == arena_id)):
                raise GameError("arena_missing", 404)
            if db.scalar(select(arenas.c.ends).where(arenas.c.id == arena_id)) is not None:
                raise GameError("registration_closed", 409)
            if join:
                db.execute(insert(arena_members).values(arena=arena_id, player=player).on_conflict_do_nothing())
            else:
                db.execute(delete(arena_members).where(arena_members.c.arena == arena_id, arena_members.c.player == player))
        return {"ok": True}

    def control(self, arena_id, player, action, played):
        now = self.games.now_ms()
        members = arena_members
        with self.engine.begin() as db:
            db.exec_driver_sql("BEGIN IMMEDIATE")
            arena = db.execute(select(arenas).where(arenas.c.id == arena_id)).mappings().first()
            if not arena:
                raise GameError("arena_missing", 404)
            if action in ("start", "finish"):
                if arena["owner"] != player:
                    raise GameError("owner_required", 403)
                if action == "start" and arena["ends"] is None:
                    entrants = db.scalar(select(func.count()).select_from(members).where(members.c.arena == arena_id))
                    if entrants < 2:
                        raise GameError("need_two_players", 409)
                    db.execute(update(arenas).where(arenas.c.id == arena_id).values(ends=now + 30 * 60000))
                if action == "finish" and arena["ends"] is not None and arena["ends"] > now:
                    db.execute(update(arenas).where(arenas.c.id == arena_id).values(ends=now))
                return {"ok": True}
            if arena["ends"] is None or arena["ends"] <= now:
                raise GameError("arena_closed", 409)
            seat = (members.c.arena == arena_id) & (members.c.player == player)
            if not db.scalar(select(members.c.player).where(seat)):
                raise GameError("registration_required", 403)
            mine = (games.c.owner == player) | (games.c.guest == player)
            count = db.scalar(select(func.count()).select_from(games).where(games.c.arena_id == arena_id, mine))
            if played != count:
                return {"ok": True}
            if action == "pause":
                db.execute(update(members).where(seat).values(ready=None))
                return {"ok": True}
            if db.scalar(select(games.c.id).where(games.c.arena_id.is_not(None), mine, games.c.result.is_(None)).limit(1)):
                raise GameError("already_playing", 409)
            # A player can wait on one arena at a time.
            db.execute(update(members).where(members.c.player == player, members.c.arena != arena_id).values(ready=None))
            rival = db.scalar(select(members.c.player).where(members.c.arena == arena_id,
                members.c.player != player, members.c.ready.is_not(None)).order_by(members.c.ready, members.c.player).limit(1))
            if not rival:
                db.execute(update(members).where(seat, members.c.ready.is_(None)).values(ready=now))
                return {"ok": True}
            previous = db.scalar(select(games.c.owner).where(games.c.arena_id == arena_id,
                games.c.owner.in_([rival, player]), games.c.guest.in_([rival, player]))
                .order_by(games.c.finished_ms.desc()).limit(1))
            white, black = (player, rival) if previous == rival else (rival, player)
            game_id = self.games.insert_game(db, white, True, (5, 3), guest=black)
            db.execute(update(games).where(games.c.id == game_id).values(arena_id=arena_id))
            db.execute(update(members).where(members.c.arena == arena_id, members.c.player.in_([rival, player])).values(ready=None))
            return {"ok": True}
