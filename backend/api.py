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

from .private_messages import PrivateMessages
from .chat import Chat
from .teams import Teams
from .arenas import Arenas
from .analysis import analyse, practice_position
from .computer import executable, play_pending, play_turn
from .accounts import Accounts, SESSION_SECONDS, digest
from .notifications import Notifications
from .challenges import Challenges
from .db import open_database
from .domain import GameError
from .matchmaking import Matchmaking
from .puzzle_attempts import PuzzleAttempts
from .opening_positions import review_position, save_position, schedule_review
from .opening_frequency import continuations
from .puzzles import puzzle_by_id, random_puzzle
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


class OpeningPosition(BaseModel):
    chapter: str = Field(pattern=r"^[a-z0-9-]{1,64}$")
    line: int = Field(ge=0, lt=12)
    ply: int = Field(ge=0, lt=100)
    fen: str = Field(min_length=1, max_length=128)
    side: Literal["w", "b"]
    expected: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")


class OpeningAnswer(OpeningPosition):
    due_at: int = Field(ge=0, le=2**53 - 1)
    correct: bool


class PuzzleProgress(BaseModel):
    id: UUID
    puzzle: str = Field(pattern=r"^[A-Za-z0-9]{1,16}$")
    mistakes: int = Field(ge=0, le=1000000)
    solved: bool


class ReviewVariation(BaseModel):
    ply: int = Field(ge=1)
    moves: list[Annotated[str, Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")]] = Field(max_length=256)


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
    chess960: bool = False
    rated: bool = False
    control: TimeControl


class ChatPost(BaseModel):
    token: UUID
    body: str = Field(min_length=1, max_length=500)


class PrivatePost(ChatPost):
    recipient: str = Field(min_length=1, max_length=32)


class PrivateItem(BaseModel):
    seq: int
    sender: str
    recipient: str
    body: str
    created: int
    outgoing: bool


class PrivatePage(BaseModel):
    items: list[PrivateItem]
    before: int | None


class InvitePlayer(BaseModel):
    name: str = Field(min_length=1, max_length=32)


class NamedGroup(BaseModel):
    id: UUID
    name: str = Field(min_length=1, max_length=80)


class Visibility(BaseModel):
    public: bool
    version: int = Field(ge=0)


class CreateGame(BaseModel):
    chess960: int | None = Field(None, ge=0, le=959, strict=True)
    public: bool = False
    engine_name: Literal["lc0", "stockfish"] = "lc0"
    engine_level: Literal["easy", "casual", "normal", "strong", "expert"] | None = None
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
    inline_engine_replies = os.environ.get("VERCEL") == "1"

    @asynccontextmanager
    async def lifespan(app):
        engine = open_database(path)
        app.state.studies = Studies(engine)
        app.state.attempts = PuzzleAttempts(engine)
        app.state.notifications = Notifications(engine)
        app.state.accounts = Accounts(engine)
        app.state.games = Games(engine)
        app.state.private_messages = PrivateMessages(engine)
        app.state.chat = Chat(engine)
        app.state.teams = Teams(engine)
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
                if inline_engine_replies:
                    return  # Recover pending games once. New moves run within the function invocation.
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

    @app.get("/api/private-messages", response_model=PrivatePage)
    def private_page(request: Request, response: Response, before: int | None = Query(default=None, ge=1)):
        response.headers["Cache-Control"] = "private, no-store"
        return app.state.private_messages.page(member(request), before)

    @app.post("/api/private-messages")
    def private_send(command: PrivatePost, request: Request):
        app.state.private_messages.send(member(request), command.recipient, command.token.hex, command.body)
        return {"ok": True}

    @app.get("/api/chat")
    def chat_feed(request: Request, response: Response):
        response.headers["Cache-Control"] = "private, no-store"
        return app.state.chat.feed(current(request)[0])

    @app.post("/api/chat/messages")
    def chat_send(command: ChatPost, request: Request):
        app.state.chat.send(member(request), command.token.hex, command.body)
        return {"ok": True}

    @app.post("/api/chat/preferences/{action}")
    def chat_mute(action: Literal["mute", "unmute"], request: Request):
        app.state.chat.mute(member(request), action == "mute")
        return {"ok": True}

    @app.post("/api/chat/authors/{action}")
    def chat_block(action: Literal["block", "unblock"], command: InvitePlayer, request: Request):
        app.state.chat.block(member(request), command.name, action == "block")
        return {"ok": True}

    @app.post("/api/chat/messages/{seq}/report")
    def chat_report(seq: int, request: Request):
        app.state.chat.report(member(request), seq)
        return {"ok": True}

    @app.post("/api/chat/reports/{seq}/{decision}")
    def chat_review(seq: int, decision: Literal["hide", "dismiss"], request: Request):
        app.state.chat.review(member(request), seq, decision)
        return {"ok": True}

    @app.get("/api/teams")
    def team_list(request: Request, response: Response):
        response.headers["Cache-Control"] = "private, no-store"
        return app.state.teams.overview(member(request))

    @app.post("/api/teams", status_code=201)
    def create_team(command: NamedGroup, request: Request):
        app.state.teams.create(member(request), command.id.hex, command.name)
        return {"ok": True}

    @app.get("/api/teams/blocks")
    def team_blocks(request: Request, response: Response):
        response.headers["Cache-Control"] = "private, no-store"
        return app.state.teams.blocked(member(request))

    @app.post("/api/teams/blocks/{action}")
    def change_team_block(action: Literal["block", "unblock"], command: InvitePlayer, request: Request):
        app.state.teams.block(member(request), command.name, action == "block")
        return {"ok": True}

    @app.post("/api/teams/{key}/invite")
    def invite_teammate(key: UUID, command: InvitePlayer, request: Request):
        app.state.teams.invite(member(request), key.hex, command.name)
        return {"ok": True}

    @app.post("/api/teams/{key}/{action}")
    def respond_to_team(key: UUID, action: Literal["accept", "decline"], request: Request):
        app.state.teams.respond(member(request), key.hex, action == "accept")
        return {"ok": True}

    @app.post("/api/arenas", status_code=201)
    def create_arena(command: NamedGroup, request: Request):
        return app.state.arenas.create(member(request), command.id.hex, command.name)

    @app.get("/api/arenas")
    def arena_list(offset: int = Query(0, ge=0)):
        return app.state.arenas.listing(offset)

    @app.get("/api/arenas/{arena_id}")
    def arena_view(arena_id: UUID, request: Request):
        player, name = current(request)
        return app.state.arenas.view(arena_id.hex, player if name else None)

    @app.post("/api/arenas/{arena_id}/play/{action}")
    def play_arena(arena_id: UUID, action: Literal["start", "finish", "ready", "pause"], request: Request,
                   played: int = Query(0, ge=0)):
        return app.state.arenas.control(arena_id.hex, member(request), action, played)

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
    def pending_challenges(request: Request, include_expired: bool = False):
        player, name = current(request)
        return {"member": bool(name), "items": app.state.challenges.pending(player) if name else [],
                "expired": app.state.challenges.expired_incoming(player) if include_expired and name else []}

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
        return app.state.queue.change(player, command.version, "start", (command.control.minutes, command.control.increment), command.rated, command.chess960)

    @app.post("/api/queue/{action}")
    def update_search(action: Literal["cancel", "renew"], command: QueueVersion, request: Request):
        player = current(request)[0]
        if not player:
            raise GameError("session_required", 401)
        return app.state.queue.change(player, command.version, action)

    @app.get("/api/profile/games")
    def archive(request: Request, offset: int = Query(0, ge=0), active: bool = False,
                side: Literal["all", "white", "black"] = "all"):
        player = current(request)[0]
        if not player:
            return {"items": [], "next_offset": None}
        if active:
            return app.state.games.active_games(player, offset, 20)
        return app.state.games.archive(player, offset, 20, side)

    @app.post("/api/games", status_code=201)
    def create(request: Request, response: Response, options: CreateGame | None = None):
        control = options.control if options else None
        level = options.engine_level if options else None
        name = options.engine_name if options else "lc0"
        if level and options.chess960 is not None:
            raise GameError("variant_unavailable", 422)
        if level and not executable(name):
            raise GameError("engine_unavailable", 503)
        return app.state.games.create(player_session(request, response), bool(options and options.online),
                                      (control.minutes, control.increment) if control else None, engine_level=level, engine_name=name,
                                      public=bool(options and options.public), chess960=options.chess960 if options else None)

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

    @app.post("/api/games/{game_id}/practice")
    def practice(game_id: str, variation: ReviewVariation, request: Request):
        game = app.state.games.get(game_id, current(request)[0])
        return practice_position(game, variation.ply, variation.moves)

    @app.get("/api/games/{game_id}/move-times")
    def move_times(game_id: str, request: Request):
        return app.state.games.move_times(game_id, current(request)[0])

    @app.get("/api/games/{game_id}/analysis")
    async def analysis(game_id: str, request: Request, engine: Literal["lc0", "stockfish"], ply: int = Query(ge=0), compare: bool = False):
        game = await asyncio.to_thread(lambda: app.state.games.get(game_id, current(request)[0]))
        return await analyse(game, ply, engine, request, app.state.analysis_slots, compare)

    @app.post("/api/games/{game_id}/moves")
    def move(game_id: str, command: Move, request: Request):
        player = current(request)[0]
        result = app.state.games.apply(game_id, player, command.uci, command.version, str(command.command_id))
        if inline_engine_replies and result.get("engine_level") and result["turn"] == "black" and not result["result"]:
            play_turn(app.state.games, game_id, result["version"], result["engine_name"], result["engine_level"])
            result = app.state.games.get(game_id, player)
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

    @app.get("/api/openings/positions")
    def get_opening_review(request: Request, response: Response, offset: int = Query(0, ge=0, le=2147483647)):
        response.headers["Cache-Control"] = "private, no-store"
        return review_position(app.state.games.engine, current(request)[0], offset)

    @app.post("/api/openings/review")
    def finish_opening_review(command: OpeningAnswer, request: Request):
        return schedule_review(app.state.games.engine, current(request)[0], command.model_dump())

    @app.post("/api/openings/positions")
    def record_opening_position(command: OpeningPosition, request: Request, response: Response):
        save_position(app.state.games.engine, player_session(request, response), command.model_dump())
        return {"ok": True}

    @app.get("/api/profile/puzzle-progress")
    def puzzle_progress(request: Request, response: Response, days: Literal["7", "30", "90"] = "30"):
        response.headers["Cache-Control"] = "private, no-store"
        return app.state.attempts.progress(current(request)[0], int(days), catalogue)

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

    @app.get("/api/puzzles/by-id/{puzzle_id}")
    def get_puzzle(puzzle_id: str, response: Response):
        response.headers["Cache-Control"] = "no-store"
        return puzzle_by_id(catalogue, puzzle_id)

    build = Path(__file__).resolve().parents[1] / "build"
    if build.is_dir():
        app.mount("/", StaticFiles(directory=build, html=True), name="client")
    return app


default_db = "/tmp/chessboard.sqlite3" if os.environ.get("VERCEL") == "1" else "chessboard.sqlite3"
app = create_app(Path(os.environ.get("CHESSBOARD_DB", default_db)))
