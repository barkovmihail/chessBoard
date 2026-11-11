from alembic import op
import sqlalchemy as sa

revision = "005_rematch"
down_revision = "004_clocks"


def upgrade():
    op.add_column("games", sa.Column("rematch_offer", sa.String()))
    for name in ("previous_game", "next_game"):
        op.execute(f"ALTER TABLE games ADD COLUMN {name} VARCHAR REFERENCES games(id)")
