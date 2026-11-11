import sqlalchemy as sa
from alembic import op

revision = "026_move_times"
down_revision = "025_private_messages"


def upgrade():
    op.add_column("moves", sa.Column("elapsed_ms", sa.Integer(), nullable=True))
