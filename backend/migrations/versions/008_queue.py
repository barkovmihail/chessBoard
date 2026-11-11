from alembic import op
import sqlalchemy as sa

revision = "008_queue"
down_revision = "007_accounts"


def upgrade():
    op.create_table("match_queue", sa.Column("player", sa.String(), primary_key=True),
        sa.Column("version", sa.Integer(), nullable=False), sa.Column("minutes", sa.Integer(), nullable=False),
        sa.Column("increment", sa.Integer(), nullable=False), sa.Column("started", sa.Integer(), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False), sa.Column("game_id", sa.String(), sa.ForeignKey("games.id")))
