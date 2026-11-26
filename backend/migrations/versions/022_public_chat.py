import sqlalchemy as sa
from alembic import op

revision = "022_public_chat"
down_revision = "021_team_blocks"


def upgrade():
    for field in ("chat_muted", "chat_moderator"):
        op.add_column("accounts", sa.Column(field, sa.Boolean(), nullable=False, server_default="0"))
    op.create_table("chat_messages",
        sa.Column("seq", sa.Integer(), primary_key=True),
        sa.Column("token", sa.String(), nullable=False),
        sa.Column("author", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("body", sa.String(), nullable=False),
        sa.Column("hidden", sa.Boolean(), nullable=False, server_default="0"),
        sa.UniqueConstraint("author", "token"))
    op.create_table("chat_blocks",
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True),
        sa.Column("author", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True))
    op.create_table("chat_reports",
        sa.Column("message", sa.Integer(), sa.ForeignKey("chat_messages.seq"), primary_key=True),
        sa.Column("reporter", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True),
        sa.Column("decision", sa.String()), sa.Column("reviewer", sa.String(), sa.ForeignKey("accounts.player")))
