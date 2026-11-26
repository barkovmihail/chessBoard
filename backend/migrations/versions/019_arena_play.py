from alembic import op
import sqlalchemy as sa

revision = "019_arena_play"
down_revision = "018_arenas"


def upgrade():
    op.add_column("arenas", sa.Column("ends", sa.Integer()))
    op.add_column("arena_members", sa.Column("ready", sa.Integer()))
    op.execute("ALTER TABLE games ADD COLUMN arena_id VARCHAR REFERENCES arenas(id)")
    op.create_index("ix_games_arena_id", "games", ["arena_id"])
