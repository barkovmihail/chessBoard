from alembic import op
import sqlalchemy as sa

revision = "017_watch_links"
down_revision = "016_study_chapters"


def upgrade():
    op.add_column("games", sa.Column("watch_key", sa.String()))
    op.create_index("ix_games_watch_key", "games", ["watch_key"], unique=True)
