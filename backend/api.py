import asyncio
import os
import secrets
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID
from typing import Literal

from anyio import from_thread
from fastapi import FastAPI, Query, Request, Response, WebSocket
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .accounts import Accounts, SESSION_SECONDS, digest
from .db import open_database
from .domain import GameError
from .matchmaking import Matchmaking
from .puzzles import random_puzzle
from .service import Games
from .events import GameEvents


class TimeControl(BaseModel):
    minutes: int = Field(ge=1, le=1440, strict=True)
    increment: int = Field(ge=0, le=3600, strict=True)


class QueueVersion(BaseModel):
    version: int = Field(ge=0)


class Search(QueueVersion):
    rated: bool = False
    control: TimeControl


class CreateGame(BaseModel):
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
        app.state.accounts = Accounts(engine)
        app.state.games = Games(engine)
        app.state.queue = Matchmaking(app.state.games)
        app.state.events = GameEvents()
        async def monitor():
            while True:
                for game_id in await asyncio.to_thread(app.state.games.expire_due):
                    app.state.events.publish(game_id)
                await asyncio.sleep(0.25)

        timer = asyncio.create_task(monitor())
        try:
            yield
        finally:
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
        return await call_next(request)

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
        return app.state.games.create(player_session(request, response), bool(options and options.online),
                                      (control.minutes, control.increment) if control else None)

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

    @app.get("/api/puzzles/random")
    def puzzle():
        return random_puzzle(catalogue)

    build = Path(__file__).resolve().parents[1] / "build"
    if build.is_dir():
        app.mount("/", StaticFiles(directory=build, html=True), name="client")
    return app


app = create_app(Path(os.environ.get("CHESSBOARD_DB", "chessboard.sqlite3")))
