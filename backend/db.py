from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import JSON, Boolean, Column, Index, ForeignKey, Integer, LargeBinary, MetaData, String, Table, UniqueConstraint, create_engine, event
from sqlalchemy.engine import URL

metadata = MetaData()
study_chapters = Table("study_chapters", metadata,
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("side", String, nullable=False), Column("lines", JSON, nullable=False),
)
puzzle_attempts = Table("puzzle_attempts", metadata,
    Column("player", String, primary_key=True), Column("id", String, primary_key=True),
    Column("puzzle", String, nullable=False), Column("started", Integer, nullable=False),
    Column("mistakes", Integer, nullable=False), Column("solved", Boolean, nullable=False),
    Index("ix_attempts_history", "player", "started", "id"),
)
accounts = Table("accounts", metadata,
    Column("chat_muted", Boolean, nullable=False, server_default="0"),
    Column("chat_moderator", Boolean, nullable=False, server_default="0"),
    Column("notify_sound", Boolean, nullable=False, server_default="0"),
    Column("notify_turn", Boolean, nullable=False, server_default="1"),
    Column("notify_finish", Boolean, nullable=False, server_default="1"),
    Column("notify_challenge", Boolean, nullable=False, server_default="1"),
    Column("notify_response", Boolean, nullable=False, server_default="1"),
    Column("player", String, primary_key=True),
    Column("name", String(collation="NOCASE"), nullable=False, unique=True),
    Column("salt", LargeBinary, nullable=False),
    Column("password_hash", LargeBinary, nullable=False),
)
chat_messages = Table("chat_messages", metadata,
    Column("seq", Integer, primary_key=True), Column("token", String, nullable=False),
    Column("author", ForeignKey("accounts.player"), nullable=False), Column("body", String, nullable=False),
    Column("hidden", Boolean, nullable=False, server_default="0"), UniqueConstraint("author", "token"),
)
chat_blocks = Table("chat_blocks", metadata,
    Column("player", ForeignKey("accounts.player"), primary_key=True), Column("author", ForeignKey("accounts.player"), primary_key=True),
)
chat_reports = Table("chat_reports", metadata,
    Column("message", ForeignKey("chat_messages.seq"), primary_key=True), Column("reporter", ForeignKey("accounts.player"), primary_key=True),
    Column("decision", String), Column("reviewer", ForeignKey("accounts.player")),
)
teams = Table("teams", metadata,
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("owner", ForeignKey("accounts.player"), nullable=False),
)
team_invite_blocks = Table("team_invite_blocks", metadata,
    Column("player", ForeignKey("accounts.player"), primary_key=True),
    Column("sender", ForeignKey("accounts.player"), primary_key=True),
)
team_seats = Table("team_seats", metadata,
    Column("team", ForeignKey("teams.id"), primary_key=True),
    Column("player", ForeignKey("accounts.player"), primary_key=True), Column("joined", Boolean, nullable=False),
    Index("ix_team_seats_player", "player"),
)
arenas = Table("arenas", metadata,
    Column("ends", Integer),
    Column("id", String, primary_key=True), Column("name", String, nullable=False),
    Column("owner", ForeignKey("accounts.player"), nullable=False), Column("created", Integer, nullable=False),
)
arena_members = Table("arena_members", metadata,
    Column("ready", Integer),
    Column("arena", ForeignKey("arenas.id"), primary_key=True),
    Column("player", ForeignKey("accounts.player"), primary_key=True),
)
sessions = Table("account_sessions", metadata,
    Column("digest", String, primary_key=True),
    Column("player", ForeignKey("accounts.player"), nullable=False),
    Column("expires", Integer, nullable=False),
)
games = Table("games", metadata,
    Column("chess960", Integer),
    Column("arena_id", ForeignKey("arenas.id"), index=True),
    Column("watch_key", String, unique=True, index=True),
    Column("engine_level", String),
    Column("rated", Boolean, nullable=False, server_default="0"),
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
rating_history = Table("rating_history", metadata,
    Column("seq", Integer, primary_key=True), Column("game_id", ForeignKey("games.id"), nullable=False),
    Column("player", ForeignKey("accounts.player"), nullable=False), Column("pool", String, nullable=False),
    Column("value", Integer, nullable=False), UniqueConstraint("game_id", "player"),
    Index("ix_rating_player_pool_seq", "player", "pool", "seq"),
)
queue = Table("match_queue", metadata,
    Column("chess960", Boolean, nullable=False, server_default="0"),
    Column("rated", Boolean, nullable=False, server_default="0"),
    Column("player", String, primary_key=True), Column("version", Integer, nullable=False),
    Column("minutes", Integer, nullable=False), Column("increment", Integer, nullable=False),
    Column("started", Integer, nullable=False), Column("expires", Integer, nullable=False),
    Column("game_id", ForeignKey("games.id")),
)
challenges = Table("challenges", metadata,
    Column("id", String, primary_key=True), Column("sender", ForeignKey("accounts.player"), nullable=False),
    Column("recipient", ForeignKey("accounts.player"), nullable=False), Column("minutes", Integer, nullable=False),
    Column("increment", Integer, nullable=False), Column("expires", Integer, nullable=False),
    Column("status", String, nullable=False), Column("game_id", ForeignKey("games.id")),
)
notifications = Table("notifications", metadata,
    Column("id", Integer, primary_key=True), Column("player", ForeignKey("accounts.player"), nullable=False),
    Column("game_id", ForeignKey("games.id")), Column("ply", Integer),
    Column("challenge_id", ForeignKey("challenges.id")), Column("kind", String, nullable=False),
    Column("created", Integer, nullable=False), Column("seen", Boolean, nullable=False, server_default="0"),
    UniqueConstraint("player", "game_id", "kind", "ply", name="uq_game_notice"),
    UniqueConstraint("player", "challenge_id", "kind"), Index("ix_notifications_player_id", "player", "id"),
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
