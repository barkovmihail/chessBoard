from alembic import op
import sqlalchemy as sa

revision = "009_ratings"
down_revision = "008_queue"


def upgrade():
    for table in ("games", "match_queue"):
        op.add_column(table, sa.Column("rated", sa.Boolean(), nullable=False, server_default="0"))
    op.create_table("rating_history",
        sa.Column("seq", sa.Integer(), primary_key=True),
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), nullable=False),
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("pool", sa.String(), nullable=False), sa.Column("value", sa.Integer(), nullable=False),
        sa.UniqueConstraint("game_id", "player"))
    op.create_index("ix_rating_player_pool_seq", "rating_history", ["player", "pool", "seq"])
