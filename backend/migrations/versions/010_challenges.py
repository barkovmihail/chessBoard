from alembic import op
import sqlalchemy as sa

revision = "010_challenges"
down_revision = "009_ratings"


def upgrade():
    op.create_table("challenges", sa.Column("id", sa.String(), primary_key=True),
        sa.Column("sender", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("recipient", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("minutes", sa.Integer(), nullable=False), sa.Column("increment", sa.Integer(), nullable=False),
        sa.Column("expires", sa.Integer(), nullable=False), sa.Column("status", sa.String(), nullable=False),
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id")))
