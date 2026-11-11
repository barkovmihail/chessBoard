from alembic import op
import sqlalchemy as sa

revision = "011_notifications"
down_revision = "010_challenges"


def upgrade():
    for name in ("notify_challenge", "notify_response"):
        op.add_column("accounts", sa.Column(name, sa.Boolean(), nullable=False, server_default="1"))
    op.create_table("notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("challenge_id", sa.String(), sa.ForeignKey("challenges.id"), nullable=False),
        sa.Column("kind", sa.String(), nullable=False), sa.Column("created", sa.Integer(), nullable=False),
        sa.Column("seen", sa.Boolean(), nullable=False, server_default="0"),
        sa.UniqueConstraint("player", "challenge_id", "kind"))
    op.create_index("ix_notifications_player_id", "notifications", ["player", "id"])
