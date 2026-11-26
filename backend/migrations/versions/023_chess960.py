import sqlalchemy as sa
from alembic import op

revision = "023_chess960"
down_revision = "022_public_chat"


def upgrade():
    op.add_column("games", sa.Column("chess960", sa.Integer()))
