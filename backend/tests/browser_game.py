"""Run after npm run build. Uses temporary SQLite and a local Chromium browser."""
import os
from pathlib import Path
from socket import socket
from tempfile import TemporaryDirectory
from threading import Thread
from time import monotonic, sleep
from unittest import TestCase, main

from playwright.sync_api import expect, sync_playwright
from uvicorn import Config, Server

from backend.api import create_app


class BrowserGameTest(TestCase):
    def test_saved_move(self):
        with TemporaryDirectory() as directory, socket() as listener:
            listener.bind(("127.0.0.1", 0))
            port = listener.getsockname()[1]
            server = Server(Config(create_app(Path(directory) / "test.sqlite3"), log_level="warning"))
            worker = Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
            worker.start()
            try:
                deadline = monotonic() + 10
                while not server.started and monotonic() < deadline:
                    sleep(0.02)
                self.assertTrue(server.started)
                with sync_playwright() as playwright:
                    browser = playwright.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
                    page = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True)
                    page.goto(f"http://127.0.0.1:{port}")
                    page.get_by_role("button", name="Начать партию").tap()
                    page.locator('[data-square="e2"]').tap()
                    page.locator('[data-square="e4"]').tap()
                    expect(page.get_by_text("Ход чёрных")).to_be_visible()
                    page.reload()
                    expect(page.locator('[data-square="e4"] [role=img]')).to_have_attribute("aria-label", "white pawn e4")
                    expect(page.locator('[data-square="e2"] [role=img]')).to_have_count(0)
                    expect(page.get_by_text("Ход чёрных")).to_be_visible()
                    expect(page.get_by_text("e4", exact=True)).to_be_visible()
                    browser.close()
            finally:
                server.should_exit = True
                worker.join(timeout=10)


if __name__ == "__main__":
    main()
