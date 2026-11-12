import sqlalchemy as sa
from alembic import op

revision = "028_opening_schedule"
down_revision = "027_opening_positions"


def upgrade():
    for name in ("due_at", "interval_days"):
        op.add_column("opening_positions", sa.Column(name, sa.Integer(), nullable=False, server_default="0"))
    op.create_index("ix_opening_due", "opening_positions", ["player", "due_at"])
