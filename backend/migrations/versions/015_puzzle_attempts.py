from alembic import op
import sqlalchemy as sa

revision = "015_puzzle_attempts"
down_revision = "014_computer"


def upgrade():
    op.create_table("puzzle_attempts",
        sa.Column("player", sa.String(), primary_key=True),
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("puzzle", sa.String(), nullable=False),
        sa.Column("started", sa.Integer(), nullable=False),
        sa.Column("mistakes", sa.Integer(), nullable=False),
        sa.Column("solved", sa.Boolean(), nullable=False))
    op.create_index("ix_attempts_history", "puzzle_attempts", ["player", "started", "id"])
