import sqlalchemy as sa
from alembic import op

revision = "027_opening_positions"
down_revision = "026_move_times"


def upgrade():
    op.create_table("opening_positions",
        sa.Column("player", sa.String(), primary_key=True),
        sa.Column("chapter", sa.String(), primary_key=True),
        sa.Column("line", sa.Integer(), primary_key=True),
        sa.Column("ply", sa.Integer(), primary_key=True),
        sa.Column("fen", sa.String(), primary_key=True),
        sa.Column("expected", sa.String(), primary_key=True),
        sa.Column("side", sa.String(), nullable=False))
