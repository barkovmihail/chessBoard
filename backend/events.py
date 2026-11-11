import asyncio
from contextlib import contextmanager, suppress

from anyio import create_task_group
from fastapi import WebSocket, WebSocketDisconnect
from starlette.concurrency import run_in_threadpool

from .domain import GameError


class GameEvents:
    """Single-process subscriptions. Only the event loop accesses this registry."""

    def __init__(self):
        self.listeners: dict[str, set[asyncio.Event]] = {}

    @contextmanager
    def subscribe(self, game_id):
        changed = asyncio.Event()
        listeners = self.listeners.setdefault(game_id, set())
        listeners.add(changed)
        try:
            yield changed
        finally:
            listeners.remove(changed)
            if not listeners:
                del self.listeners[game_id]

    def publish(self, game_id):
        for changed in self.listeners.get(game_id, ()):
            changed.set()

    async def stream(self, socket: WebSocket, game_id: str, read_snapshot):
        with self.subscribe(game_id) as changed:
            try:
                initial = await run_in_threadpool(read_snapshot)
            except GameError:
                await socket.close(code=1008)
                return
            await socket.accept()

            async def send_updates():
                snapshot = initial
                while True:
                    await socket.send_json({"type": "snapshot", "game": snapshot})
                    await changed.wait()
                    changed.clear()
                    snapshot = await run_in_threadpool(read_snapshot)

            async def receive_disconnect():
                while (await socket.receive())["type"] != "websocket.disconnect":
                    pass

            async with create_task_group() as group:
                async def send_until_closed():
                    try:
                        with suppress(WebSocketDisconnect, OSError):
                            await send_updates()
                    except GameError:
                        await socket.close(code=1008)
                    finally:
                        group.cancel_scope.cancel()

                group.start_soon(send_until_closed)
                try:
                    await receive_disconnect()
                finally:
                    group.cancel_scope.cancel()
