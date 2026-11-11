from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import JSON, Boolean, Column, ForeignKey, Integer, LargeBinary, MetaData, String, Table, UniqueConstraint, create_engine, event
from sqlalchemy.engine import URL

metadata = MetaData()
accounts = Table("accounts", metadata,
    Column("player", String, primary_key=True),
    Column("name", String(collation="NOCASE"), nullable=False, unique=True),
    Column("salt", LargeBinary, nullable=False),
    Column("password_hash", LargeBinary, nullable=False),
)
sessions = Table("account_sessions", metadata,
    Column("digest", String, primary_key=True),
    Column("player", ForeignKey("accounts.player"), nullable=False),
    Column("expires", Integer, nullable=False),
)
games = Table("games", metadata,
    Column("id", String, primary_key=True),
    Column("owner", String, nullable=False),
    Column("online", Boolean, nullable=False, server_default="0"),
    Column("guest", String),
    Column("base_minutes", Integer),
    Column("increment_seconds", Integer),
    Column("white_ms", Integer),
    Column("black_ms", Integer),
    Column("deadline_ms", Integer, index=True),
    Column("rematch_offer", String),
    Column("previous_game", ForeignKey("games.id")),
    Column("next_game", ForeignKey("games.id")),
    Column("draw_offer", String),
    Column("finished_ms", Integer),
    Column("result", String),
    Column("reason", String),
    Column("version", Integer, nullable=False),
)
moves = Table("moves", metadata,
    Column("game_id", ForeignKey("games.id"), primary_key=True),
    Column("ply", Integer, primary_key=True),
    Column("uci", String, nullable=False),
    Column("command_id", String, nullable=False),
    UniqueConstraint("game_id", "command_id"),
)

receipts = Table("receipts", metadata,
    Column("game_id", ForeignKey("games.id"), primary_key=True),
    Column("command_id", String, primary_key=True),
    Column("player", String, nullable=False),
    Column("command", String, nullable=False),
    Column("version", Integer, nullable=False),
    Column("response", JSON, nullable=False),
)


def open_database(path: Path):
    engine = create_engine(URL.create("sqlite", database=str(path)))

    @event.listens_for(engine, "connect")
    def configure(connection, _):
        connection.execute("PRAGMA foreign_keys=ON")
        connection.execute("PRAGMA busy_timeout=5000")

    config = Config()
    config.set_main_option("script_location", str(Path(__file__).parent / "migrations"))
    with engine.begin() as connection:
        config.attributes["connection"] = connection
        command.upgrade(config, "head")
    return engine
