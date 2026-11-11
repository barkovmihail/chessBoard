import asyncio
import os
import secrets
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from threading import Event
from time import perf_counter_ns
from urllib.parse import urlsplit
from uuid import UUID
from typing import Annotated, Literal

from anyio import from_thread
from fastapi import FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .arenas import Arenas
from .analysis import analyse
from .computer import executable, play_pending
from .accounts import Accounts, SESSION_SECONDS, digest
from .notifications import Notifications
from .challenges import Challenges
from .db import open_database
from .domain import GameError
from .matchmaking import Matchmaking
from .puzzle_attempts import PuzzleAttempts
from .opening_frequency import continuations
from .puzzles import random_puzzle
from .service import Games
from .studies import Studies
from .events import GameEvents


StudyStep = tuple[Annotated[str, Field(min_length=1, max_length=12)], Annotated[str, Field(max_length=500)]]
StudyLine = Annotated[list[StudyStep], Field(min_length=1, max_length=100)]


class Chapter(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=100)
    side: Literal["w", "b"]
    lines: list[StudyLine] = Field(min_length=1, max_length=12)


class PuzzleProgress(BaseModel):
    id: UUID
    puzzle: str = Field(pattern=r"^[A-Za-z0-9]{1,16}$")
    mistakes: int = Field(ge=0, le=1000000)
    solved: bool


class TimeControl(BaseModel):
    minutes: int = Field(ge=1, le=1440, strict=True)
    increment: int = Field(ge=0, le=3600, strict=True)


class QueueVersion(BaseModel):
    version: int = Field(ge=0)


class NotificationPreference(BaseModel):
    setting: Literal["notify_challenge", "notify_response", "notify_turn", "notify_finish", "notify_sound"]
    enabled: bool


class Challenge(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z0-9_]{3,32}$")
    control: TimeControl
    command_id: UUID


class Search(QueueVersion):
    rated: bool = False
    control: TimeControl


class CreateArena(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=80)


class Visibility(BaseModel):
    public: bool
    version: int = Field(ge=0)


class CreateGame(BaseModel):
    public: bool = False
    engine_name: Literal["lc0", "stockfish"] = "lc0"
    engine_level: Literal["easy", "normal"] | None = None
    control: TimeControl | None = None
    online: bool = False


class Move(BaseModel):
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    version: int = Field(ge=0)
    command_id: UUID


class Action(BaseModel):
    action: str = Field(pattern=r"^(rematch|resign|offer|accept|decline|claim(:[a-h][1-8][a-h][1-8][qrbn]?)?)$")
    version: int = Field(ge=0)
    command_id: UUID


class Credentials(BaseModel):
    name: str = Field(pattern=r"^[a-zA-Z0-9_]{3,32}$")
    password: str = Field(min_length=8, max_length=128)


def create_app(path: Path):
    @asynccontextmanager
    async def lifespan(app):
        engine = open_database(path)
        app.state.studies = Studies(engine)
        app.state.attempts = PuzzleAttempts(engine)
        app.state.notifications = Notifications(engine)
        app.state.accounts = Accounts(engine)
        app.state.games = Games(engine)
        app.state.arenas = Arenas(app.state.games)
        app.state.challenges = Challenges(app.state.games)
        app.state.queue = Matchmaking(app.state.games)
        app.state.events = GameEvents()
        async def monitor():
            while True:
                for game_id in await asyncio.to_thread(app.state.games.expire_due):
                    app.state.events.publish(game_id)
                await asyncio.sleep(0.25)

        app.state.analysis_slots = asyncio.Semaphore(2)
        stopped = Event()

        async def computer_turns():
            while not stopped.is_set():
                for game_id in await asyncio.to_thread(lambda: list(play_pending(app.state.games, stopped))):
                    app.state.events.publish(game_id)
                await asyncio.sleep(0.5)

        computer = asyncio.create_task(computer_turns())
        timer = asyncio.create_task(monitor())
        try:
            yield
        finally:
            stopped.set()
            await computer
            timer.cancel()
            with suppress(asyncio.CancelledError):
                await timer
            engine.dispose()

    app = FastAPI(lifespan=lifespan)

    @app.middleware("http")
    async def same_origin(request, call_next):
        origin = request.headers.get("origin")
        if request.method == "POST" and origin and urlsplit(origin).netloc != request.headers.get("host"):
            return JSONResponse({"detail": "invalid_origin"}, status_code=403)
        if request.url.path == "/api/connection":
            start = perf_counter_ns()
            response = await call_next(request)
            response.headers["X-Server-Time-Ms"] = f"{(perf_counter_ns() - start) / 1_000_000:.3f}"
            return response
        return await call_next(request)

    @app.get("/api/connection", status_code=204)
    async def connection():
        return Response(status_code=204, headers={"Cache-Control": "no-store"})

    @app.exception_handler(GameError)
    async def game_error(_, exc):
        return JSONResponse({"detail": exc.code}, status_code=exc.status)

    def current(request):
        return app.state.accounts.resolve(request.cookies.get("player"))

    def set_cookie(request, response, token, duration):
        response.set_cookie("player", token, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https", max_age=duration)

    def player_session(request, response):
        player, _ = current(request)
        if player:
            return player
        token = secrets.token_urlsafe(32)
        set_cookie(request, response, token, 31536000)
        return digest(token)

    @app.get("/api/account")
    def account(request: Request):
        player, name = current(request)
        return {"name": name, "ratings": app.state.games.ratings(player) if name else None}

    @app.post("/api/account/register", status_code=201)
    def register(credentials: Credentials, request: Request, response: Response):
        player, name = current(request)
        if name:
            raise GameError("already_signed_in", 409)
        token = app.state.accounts.register(credentials.name, credentials.password, player)
        set_cookie(request, response, token, SESSION_SECONDS)
        return {"ok": True}

    @app.post("/api/account/login")
    def login(credentials: Credentials, request: Request, response: Response):
        if current(request)[1]:
            raise GameError("already_signed_in", 409)
        token = app.state.accounts.login(credentials.name, credentials.password)
        set_cookie(request, response, token, SESSION_SECONDS)
        return {"ok": True}

    @app.post("/api/account/logout")
    def logout(request: Request, response: Response):
        app.state.accounts.logout(request.cookies.get("player"))
        response.delete_cookie("player")
        return {"ok": True}

    def member(request):
        player, name = current(request)
        if not name:
            raise GameError("account_required", 403)
        return player

    @app.post("/api/arenas", status_code=201)
    def create_arena(command: CreateArena, request: Request):
        return app.state.arenas.create(member(request), command.id.hex, command.name)

    @app.get("/api/arenas")
    def arena_list(offset: int = Query(0, ge=0)):
        return app.state.arenas.listing(offset)

    @app.get("/api/arenas/{arena_id}")
    def arena_view(arena_id: UUID, request: Request):
        player, name = current(request)
        return app.state.arenas.view(arena_id.hex, player if name else None)

    @app.post("/api/arenas/{arena_id}/{action}")
    def arena_action(arena_id: UUID, action: Literal["join", "leave"], request: Request):
        return app.state.arenas.register(arena_id.hex, member(request), action == "join")

    @app.get("/api/notifications")
    def notification_feed(request: Request, before: int | None = Query(None, gt=0)):
        player, name = current(request)
        if not name:
            return {"items": [], "unread": 0, "before": None, "sound": False}
        return app.state.notifications.feed(player, before)

    @app.post("/api/notifications/read")
    def read_notifications(request: Request, item: int | None = Query(None, gt=0)):
        app.state.notifications.read(member(request), item)
        return {"ok": True}

    @app.get("/api/notification-settings")
    def notification_settings(request: Request):
        return app.state.notifications.preferences(member(request))

    @app.post("/api/notification-settings")
    def change_notification_settings(request: Request, command: NotificationPreference):
        return app.state.notifications.preferences(member(request), {command.setting: command.enabled})

    @app.get("/api/challenges")
    def pending_challenges(request: Request):
        player, name = current(request)
        return {"member": bool(name), "items": app.state.challenges.pending(player) if name else []}

    @app.post("/api/challenges")
    def create_challenge(command: Challenge, request: Request):
        return app.state.challenges.create(member(request), command.name, command.control.minutes,
                                           command.control.increment, str(command.command_id))

    @app.post("/api/challenges/{challenge_id}/{action}")
    def respond_challenge(challenge_id: UUID, action: Literal["accept", "decline", "cancel"], request: Request):
        return app.state.challenges.respond(member(request), str(challenge_id), action)

    @app.get("/api/queue")
    def queue_status(request: Request):
        return app.state.queue.status(current(request)[0])

    @app.post("/api/queue/session")
    def queue_session(request: Request, response: Response):
        return app.state.queue.status(player_session(request, response))

    @app.post("/api/queue/start")
    def search(command: Search, request: Request):
        player = current(request)[0]
        if not player:
            raise GameError("session_required", 401)
        return app.state.queue.change(player, command.version, "start", (command.control.minutes, command.control.increment), command.rated)

    @app.post("/api/queue/{action}")
    def update_search(action: Literal["cancel", "renew"], command: QueueVersion, request: Request):
        player = current(request)[0]
        if not player:
            raise GameError("session_required", 401)
        return app.state.queue.change(player, command.version, action)

    @app.get("/api/profile/games")
    def archive(request: Request, offset: int = Query(0, ge=0), active: bool = False):
        player = current(request)[0]
        if not player:
            return {"items": [], "next_offset": None}
        if active:
            return app.state.games.active_games(player, offset, 20)
        return app.state.games.archive(player, offset, 20)

    @app.post("/api/games", status_code=201)
    def create(request: Request, response: Response, options: CreateGame | None = None):
        control = options.control if options else None
        level = options.engine_level if options else None
        name = options.engine_name if options else "lc0"
        if level and not executable(name):
            raise GameError("engine_unavailable", 503)
        return app.state.games.create(player_session(request, response), bool(options and options.online),
                                      (control.minutes, control.increment) if control else None, engine_level=level, engine_name=name,
                                      public=bool(options and options.public))

    @app.post("/api/games/{game_id}/visibility")
    def visibility(game_id: str, change: Visibility, request: Request):
        game = app.state.games.set_visibility(game_id, current(request)[0], change.version, change.public)
        from_thread.run_sync(app.state.events.publish, game_id)
        return game

    @app.get("/api/watch/{key}")
    def watch(key: UUID, version: int | None = Query(None, ge=0)):
        view = app.state.games.watch(key.hex, version)
        headers = {"Cache-Control": "no-store"}
        return Response(status_code=204, headers=headers) if view is None else JSONResponse(view, headers=headers)

    @app.get("/api/games/{game_id}/invitation")
    def invitation(game_id: str):
        return app.state.games.invitation(game_id)

    @app.post("/api/games/{game_id}/join")
    def join(game_id: str, request: Request, response: Response):
        result = app.state.games.join(game_id, player_session(request, response))
        from_thread.run_sync(app.state.events.publish, game_id)
        return result

    @app.get("/api/games/{game_id}")
    def get(game_id: str, request: Request):
        return app.state.games.get(game_id, current(request)[0])

    @app.get("/api/games/{game_id}/analysis")
    async def analysis(game_id: str, request: Request, engine: Literal["lc0", "stockfish"], ply: int = Query(ge=0)):
        game = await asyncio.to_thread(lambda: app.state.games.get(game_id, current(request)[0]))
        return await analyse(game, ply, engine, request, app.state.analysis_slots)

    @app.post("/api/games/{game_id}/moves")
    def move(game_id: str, command: Move, request: Request):
        result = app.state.games.apply(game_id, current(request)[0],
                                    command.uci, command.version, str(command.command_id))

        from_thread.run_sync(app.state.events.publish, game_id)
        return result

    @app.post("/api/games/{game_id}/actions")
    def action(game_id: str, command: Action, request: Request):
        result = app.state.games.apply(game_id, current(request)[0],
                                      command.action, command.version, str(command.command_id))
        from_thread.run_sync(app.state.events.publish, game_id)
        return result

    @app.websocket("/api/games/{game_id}/events")
    async def events(socket: WebSocket, game_id: str):
        scheme = "https" if socket.url.scheme == "wss" else "http"
        if socket.headers.get("origin") != f"{scheme}://{socket.headers.get('host')}":
            await socket.close(code=1008)
            return
        await app.state.events.stream(socket, game_id, lambda: app.state.games.get(game_id, current(socket)[0]))

    catalogue = Path(os.environ.get("CHESSBOARD_PUZZLES_DB", path.with_name("puzzles.sqlite3")))

    @app.get("/api/openings/frequencies")
    def frequencies(request: Request, response: Response, line: str = Query("", max_length=599)):
        response.headers["Cache-Control"] = "private, no-store"
        return continuations(app.state.games.engine, current(request)[0], line.split(",") if line else [])

    @app.post("/api/studies", status_code=201)
    def create_chapter(chapter: Chapter):
        return app.state.studies.create(chapter.id.hex, chapter.name, chapter.side, chapter.lines)

    @app.get("/api/studies/{chapter_id}")
    def get_chapter(chapter_id: UUID):
        return app.state.studies.get(chapter_id.hex)

    @app.get("/api/puzzles/attempts")
    def attempts(request: Request, offset: int = Query(0, ge=0)):
        return app.state.attempts.history(current(request)[0], offset)

    @app.post("/api/puzzles/attempts")
    def record_attempt(command: PuzzleProgress, request: Request, response: Response):
        app.state.attempts.record(player_session(request, response), str(command.id), command.puzzle,
                                  command.mistakes, command.solved)
        return {"ok": True}

    @app.get("/api/puzzles/random")
    def puzzle(request: Request, response: Response, theme: Literal["mateIn1", "mateIn2", "fork", "pin", "endgame"] | None = None):
        puzzle = random_puzzle(catalogue, theme)
        player_session(request, response)
        response.headers["Cache-Control"] = "private, no-store"
        return puzzle

    build = Path(__file__).resolve().parents[1] / "build"
    if build.is_dir():
        app.mount("/", StaticFiles(directory=build, html=True), name="client")
    return app


app = create_app(Path(os.environ.get("CHESSBOARD_DB", "chessboard.sqlite3")))
