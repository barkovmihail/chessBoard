import sqlalchemy as sa
from alembic import op

revision = "024_variant_queue"
down_revision = "023_chess960"


def upgrade():
    op.add_column("match_queue", sa.Column("chess960", sa.Boolean(), nullable=False, server_default="0"))
