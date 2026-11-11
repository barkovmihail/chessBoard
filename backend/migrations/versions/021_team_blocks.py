from alembic import op
import sqlalchemy as sa

revision = "021_team_blocks"
down_revision = "020_teams"


def upgrade():
    op.create_table("team_invite_blocks",
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True),
        sa.Column("sender", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True))
