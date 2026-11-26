from alembic import op
import sqlalchemy as sa

revision = "012_game_notices"
down_revision = "011_notifications"


def upgrade():
    for name in ("notify_turn", "notify_finish"):
        op.add_column("accounts", sa.Column(name, sa.Boolean(), nullable=False, server_default="1"))
    with op.batch_alter_table("notifications") as batch:
        batch.alter_column("challenge_id", existing_type=sa.String(), nullable=True)
        batch.add_column(sa.Column("game_id", sa.String()))
        batch.create_foreign_key("fk_notice_game", "games", ["game_id"], ["id"])
        batch.add_column(sa.Column("ply", sa.Integer()))
        batch.create_unique_constraint("uq_game_notice", ["player", "game_id", "kind", "ply"])
