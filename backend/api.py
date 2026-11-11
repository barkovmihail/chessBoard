import hashlib
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path
from urllib.parse import urlsplit
from uuid import UUID

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .db import open_database
from .domain import GameError
from .service import Games


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

    @app.post("/api/games", status_code=201)
    def create(request: Request, response: Response):
        token = request.cookies.get("player") or secrets.token_urlsafe(32)
        response.set_cookie("player", token, httponly=True, samesite="lax",
                            secure=request.url.scheme == "https", max_age=31536000)
        return app.state.games.create(identity(token))

    @app.get("/api/games/{game_id}")
    def get(game_id: str, request: Request):
        return app.state.games.get(game_id, identity(request.cookies.get("player")))

    @app.post("/api/games/{game_id}/moves")
    def move(game_id: str, command: Move, request: Request):
        return app.state.games.move(game_id, identity(request.cookies.get("player")),
                                    command.uci, command.version, str(command.command_id))

    build = Path(__file__).resolve().parents[1] / "build"
    if build.is_dir():
        app.mount("/", StaticFiles(directory=build, html=True), name="client")
    return app


app = create_app(Path(os.environ.get("CHESSBOARD_DB", "chessboard.sqlite3")))
