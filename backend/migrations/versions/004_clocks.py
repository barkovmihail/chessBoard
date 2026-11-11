from alembic import op
import sqlalchemy as sa

revision = "004_clocks"
down_revision = "003_actions"


def upgrade():
    for name in ("base_minutes", "increment_seconds", "white_ms", "black_ms", "deadline_ms"):
        op.add_column("games", sa.Column(name, sa.Integer()))
    op.create_index("ix_games_deadline_ms", "games", ["deadline_ms"])
