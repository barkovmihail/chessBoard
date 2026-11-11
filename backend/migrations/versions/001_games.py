from alembic import op
import sqlalchemy as sa

revision = "001_games"
down_revision = None


def upgrade():
    op.create_table("games",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("owner", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False))
    op.create_table("moves",
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), primary_key=True),
        sa.Column("ply", sa.Integer(), primary_key=True),
        sa.Column("uci", sa.String(), nullable=False),
        sa.Column("command_id", sa.String(), nullable=False),
        sa.UniqueConstraint("game_id", "command_id"))
