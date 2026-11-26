from alembic import op
import sqlalchemy as sa

revision = "007_accounts"
down_revision = "006_archive"


def upgrade():
    op.create_table("accounts", sa.Column("player", sa.String(), primary_key=True),
                    sa.Column("name", sa.String(collation="NOCASE"), nullable=False, unique=True),
                    sa.Column("salt", sa.LargeBinary(), nullable=False),
                    sa.Column("password_hash", sa.LargeBinary(), nullable=False))
    op.create_table("account_sessions", sa.Column("digest", sa.String(), primary_key=True),
                    sa.Column("player", sa.String(), sa.ForeignKey("accounts.player"), nullable=False),
                    sa.Column("expires", sa.Integer(), nullable=False))
