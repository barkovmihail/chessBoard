import sqlalchemy as sa
from alembic import op

revision = "025_private_messages"
down_revision = "024_variant_queue"


def upgrade():
    op.create_table("private_messages",
        sa.Column("seq", sa.Integer(), primary_key=True),
        sa.Column("sender", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("recipient", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False),
        sa.UniqueConstraint("sender", "token"))
    for side in ("sender", "recipient"):
        op.create_index("ix_private_messages_" + side, "private_messages", [side, "seq"])
