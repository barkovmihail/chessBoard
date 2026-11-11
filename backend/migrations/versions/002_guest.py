from alembic import op
import sqlalchemy as sa

revision = "002_guest"
down_revision = "001_games"


def upgrade():
    op.add_column("games", sa.Column("online", sa.Boolean(), nullable=False, server_default="0"))
    op.add_column("games", sa.Column("guest", sa.String()))
