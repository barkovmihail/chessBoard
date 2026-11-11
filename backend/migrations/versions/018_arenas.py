from alembic import op
import sqlalchemy as sa

revision = "018_arenas"
down_revision = "017_watch_links"


def upgrade():
    op.create_table("arenas",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("owner", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
        sa.Column("created", sa.Integer(), nullable=False))
    op.create_table("arena_members",
        sa.Column("arena", sa.String(), sa.ForeignKey("arenas.id"), primary_key=True),
        sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), primary_key=True))
