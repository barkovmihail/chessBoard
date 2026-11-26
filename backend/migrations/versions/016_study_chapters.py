from alembic import op
import sqlalchemy as sa

revision = "016_study_chapters"
down_revision = "015_puzzle_attempts"


def upgrade():
    op.create_table("study_chapters",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("side", sa.String(), nullable=False),
        sa.Column("lines", sa.JSON(), nullable=False))
