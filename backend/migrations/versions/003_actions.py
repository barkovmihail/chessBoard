from alembic import op
import sqlalchemy as sa

revision = "003_actions"
down_revision = "002_guest"


def upgrade():
    for name in ("draw_offer", "result", "reason"):
        op.add_column("games", sa.Column(name, sa.String()))
    op.create_table("receipts",
        sa.Column("game_id", sa.String(), sa.ForeignKey("games.id"), primary_key=True),
        sa.Column("command_id", sa.String(), primary_key=True),
        sa.Column("player", sa.String(), nullable=False),
        sa.Column("command", sa.String(), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("response", sa.JSON(), nullable=False))
