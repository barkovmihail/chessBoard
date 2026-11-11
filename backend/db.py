from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import Column, ForeignKey, Integer, MetaData, String, Table, UniqueConstraint, create_engine, event
from sqlalchemy.engine import URL

metadata = MetaData()
games = Table("games", metadata,
    Column("id", String, primary_key=True),
    Column("owner", String, nullable=False),
    Column("version", Integer, nullable=False),
)
moves = Table("moves", metadata,
    Column("game_id", ForeignKey("games.id"), primary_key=True),
    Column("ply", Integer, primary_key=True),
    Column("uci", String, nullable=False),
    Column("command_id", String, nullable=False),
    UniqueConstraint("game_id", "command_id"),
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
