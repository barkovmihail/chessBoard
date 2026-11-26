from sqlalchemy import insert, select

from .db import rating_history

POOLS = ("bullet", "blitz", "rapid", "classical")


def pool_for(minutes, increment):
    seconds = minutes * 60 + 40 * increment
    for cutoff, pool in zip((180, 480, 1500), POOLS):
        if seconds < cutoff:
            return pool
    return "classical"


def rating(db, player, pool):
    value = db.scalar(select(rating_history.c.value).where(
        rating_history.c.player == player, rating_history.c.pool == pool)
        .order_by(rating_history.c.seq.desc()).limit(1))
    return 1500 if value is None else value


def record_result(db, game, result):
    if not game["rated"]:
        return
    pool = pool_for(game["base_minutes"], game["increment_seconds"])
    white = rating(db, game["owner"], pool)
    black = rating(db, game["guest"], pool)
    expected = 1 / (1 + 10 ** ((black - white) / 400))
    score = {"1-0": 1, "0-1": 0, "1/2-1/2": 0.5}[result]
    delta = round(32 * (score - expected))
    for player, value in ((game["owner"], white + delta), (game["guest"], black - delta)):
        db.execute(insert(rating_history).values(game_id=game["id"], player=player, pool=pool, value=value))
