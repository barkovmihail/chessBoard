from alembic import op
import sqlalchemy as sa

revision = "013_notice_sound"
down_revision = "012_game_notices"


def upgrade():
    op.add_column("accounts", sa.Column("notify_sound", sa.Boolean(), nullable=False, server_default="0"))
