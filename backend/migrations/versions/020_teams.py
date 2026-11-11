from alembic import op
import sqlalchemy as sa

revision = "020_teams"
down_revision = "019_arena_play"


def upgrade():
    op.create_table("teams", sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("owner", sa.String(), sa.ForeignKey("accounts.player"), nullable=False))
    op.create_table("team_seats",
        sa.Column("team", sa.String(), sa.ForeignKey("teams.id"), primary_key=True),
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True),
        sa.Column("joined", sa.Boolean(), nullable=False))
    op.create_index("ix_team_seats_player", "team_seats", ["player"])
