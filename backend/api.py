import hashlib
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from anyio import from_thread
from fastapi import FastAPI, Request, Response, WebSocket
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import open_database
from .domain import GameError
from .puzzles import random_puzzle
from .service import Games
from .events import GameEvents


class CreateGame(BaseModel):
    online: bool = False


class Move(BaseModel):
    uci: str = Field(pattern=r"^[a-h][1-8][a-h][1-8][qrbn]?$")
    version: int = Field(ge=0)
    command_id: UUID


def identity(token):
    return hashlib.sha256(token.encode()).hexdigest() if token else None


def create_app(path: Path):
    @asynccontextmanager
    async def lifespan(app):
        engine = open_database(path)
        app.state.games = Games(engine)
        app.state.events = GameEvents()
        try:
            yield
        finally:
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

    def player_session(request, response):
        token = request.cookies.get("player") or secrets.token_urlsafe(32)
        response.set_cookie("player", token, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https", max_age=31536000)
        return identity(token)

    @app.post("/api/games", status_code=201)
    def create(request: Request, response: Response, options: CreateGame | None = None):
        return app.state.games.create(player_session(request, response), bool(options and options.online))

    @app.post("/api/games/{game_id}/join")
    def join(game_id: str, request: Request, response: Response):
        result = app.state.games.join(game_id, player_session(request, response))
        from_thread.run_sync(app.state.events.publish, game_id)
        return result

    @app.get("/api/games/{game_id}")
    def get(game_id: str, request: Request):
        return app.state.games.get(game_id, identity(request.cookies.get("player")))

    @app.post("/api/games/{game_id}/moves")
    def move(game_id: str, command: Move, request: Request):
        result = app.state.games.move(game_id, identity(request.cookies.get("player")),
                                    command.uci, command.version, str(command.command_id))

        from_thread.run_sync(app.state.events.publish, game_id)
        return result

    @app.websocket("/api/games/{game_id}/events")
    async def events(socket: WebSocket, game_id: str):
        scheme = "https" if socket.url.scheme == "wss" else "http"
        if socket.headers.get("origin") != f"{scheme}://{socket.headers.get('host')}":
            await socket.close(code=1008)
            return
        await app.state.events.stream(socket, app.state.games, game_id,
                                      identity(socket.cookies.get("player")))

    catalogue = Path(os.environ.get("CHESSBOARD_PUZZLES_DB", path.with_name("puzzles.sqlite3")))

    @app.get("/api/puzzles/random")
    def puzzle():
        return random_puzzle(catalogue)

    build = Path(__file__).resolve().parents[1] / "build"
    if build.is_dir():
        app.mount("/", StaticFiles(directory=build, html=True), name="client")
    return app


app = create_app(Path(os.environ.get("CHESSBOARD_DB", "chessboard.sqlite3")))
