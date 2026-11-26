from alembic import op
import sqlalchemy as sa
import chess

revision = "006_archive"
down_revision = "005_rematch"


def upgrade():
    op.add_column("games", sa.Column("finished_ms", sa.Integer()))
    db = op.get_bind()
    # Untimed games used to derive automatic outcomes from their move record.
    ids = db.execute(sa.text("SELECT id FROM games WHERE result IS NULL AND base_minutes IS NULL"))
    for game_id, in ids:
        board = chess.Board()
        for uci, in db.execute(sa.text("SELECT uci FROM moves WHERE game_id=:id ORDER BY ply"), {"id": game_id}):
            board.push_uci(uci)
        outcome = board.outcome()
        if outcome:
            db.execute(sa.text("UPDATE games SET result=:result, reason=:reason WHERE id=:id"),
                       {"id": game_id, "result": outcome.result(), "reason": outcome.termination.name.lower()})
