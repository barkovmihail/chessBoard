from alembic import op
import sqlalchemy as sa

revision = "014_computer"
down_revision = "013_notice_sound"


def upgrade():
    op.add_column("games", sa.Column("engine_level", sa.String()))
