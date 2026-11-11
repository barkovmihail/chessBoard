"""Run after npm run build. Uses temporary SQLite and a local Chromium browser."""
import os
from pathlib import Path
from socket import socket
from tempfile import TemporaryDirectory
from threading import Thread
from time import monotonic, sleep
from unittest import TestCase, main
from uuid import uuid4

import chess

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
                    page.add_init_script("""window.played = [];
                        const start = AudioBufferSourceNode.prototype.start;
                        AudioBufferSourceNode.prototype.start = function (...args) {
                            window.played.push(this.buffer.duration);
                            return start.apply(this, args);
                        };""")
                    page.goto(f"http://127.0.0.1:{port}")
                    page.get_by_text("Оформление", exact=True).tap()
                    for label, value in [("Доска", "green"), ("Фигуры", "merida"), ("Тема", "dark")]:
                        page.get_by_label(label, exact=True).select_option(value)
                    page.reload()
                    expect(page.locator("html")).to_have_attribute("data-theme", "dark")
                    expect(page.locator('[data-square="e2"] [role=img]')).to_have_css(
                        "background-image", f'url("http://127.0.0.1:{port}/pieces/merida/wP.svg")')
                    page.get_by_text("Звук", exact=True).tap()
                    page.get_by_role("button", name="Прослушать").tap()
                    page.wait_for_function("window.played.length === 1")
                    page.get_by_text("Звук", exact=True).tap()
                    page.get_by_role("button", name="Начать партию").tap()
                    expect(page.get_by_label("Шахматные часы")).to_contain_text("5+3")
                    page.locator('[data-square="e2"]').drag_to(page.locator('[data-square="e5"]'))
                    expect(page.get_by_text("Ход белых")).to_be_visible()
                    page.locator('[data-square="e2"]').tap()
                    page.locator('[data-square="e4"]').tap()
                    expect(page.get_by_text("Ход чёрных")).to_be_visible()
                    page.wait_for_function("window.played.length === 3")
                    page.reload()
                    expect(page.locator('[data-square="e4"] [role=img]')).to_have_attribute("aria-label", "white pawn e4")
                    expect(page.locator('[data-square="e2"] [role=img]')).to_have_count(0)
                    expect(page.get_by_text("Ход чёрных")).to_be_visible()
                    expect(page.get_by_text("e4", exact=True)).to_be_visible()
                    self.assertEqual(page.evaluate("window.played.length"), 0)
                    page.get_by_text("Звук", exact=True).tap()
                    page.get_by_label("Звуки игры").uncheck()
                    expect(page.get_by_role("button", name="Прослушать")).to_be_disabled()
                    page.reload()
                    page.get_by_text("Звук", exact=True).tap()
                    expect(page.get_by_label("Звуки игры")).not_to_be_checked()
                    page.get_by_text("Звук", exact=True).tap()
                    page.locator('[data-square="e7"]').drag_to(page.locator('[data-square="e5"]'))
                    expect(page.get_by_text("Ход белых")).to_be_visible()
                    self.assertEqual(page.evaluate("window.played.length"), 0)
                    white = browser.new_page()
                    white.goto(f"http://127.0.0.1:{port}")
                    white.get_by_role("button", name="3+0 Блиц").click()
                    white.get_by_role("button", name="Пригласить друга").click()
                    invitation = white.get_by_label("Ссылка для соперника").input_value()
                    black = browser.new_page()
                    black.goto(invitation)
                    expect(black.get_by_text("3+0", exact=True)).to_be_visible()
                    black.get_by_role("button", name="Играть за чёрных").click()
                    expect(black.locator("[data-square]").first).to_have_attribute("data-square", "h1")
                    third = browser.new_page()
                    third.goto(invitation)
                    third.get_by_role("button", name="Играть за чёрных").click()
                    expect(third.get_by_text("Оба места уже заняты.")).to_be_visible()

                    for player, start, end in [(white, "f2", "f3"), (black, "e7", "e5"),
                                               (white, "g2", "g4"), (black, "d8", "h4")]:
                        if start == "e7":
                            player.locator('[data-square="e7"]').drag_to(player.locator('[data-square="e5"]'))
                            continue
                        player.locator(f'[data-square="{start}"]').click()
                        if start == "d8":
                            white.context.set_offline(True)
                        player.locator(f'[data-square="{end}"]').click()
                    expect(black.get_by_text("0-1", exact=True)).to_be_visible()
                    white.context.set_offline(False)
                    expect(white.get_by_text("0-1", exact=True)).to_be_visible()
                    expect(white.get_by_text("f3 e5 g4 Qh4#", exact=True)).to_be_visible()
                    review = black.get_by_role("navigation", name="Просмотр партии")
                    review.get_by_role("button", name="В начало").click()
                    expect(review.get_by_text("Начальная позиция")).to_be_visible()
                    expect(black.locator('[data-square="f2"] [role=img]')).to_have_count(1)
                    review.get_by_role("button", name="Вперёд").click()
                    expect(review.get_by_text("1. f3")).to_be_visible()
                    expect(black.locator('[data-square="f3"] [role=img]')).to_have_count(1)
                    review.get_by_role("button", name="В конец").click()
                    expect(review.get_by_text("2… Qh4#")).to_be_visible()
                    review.get_by_role("button", name="Назад").click()
                    expect(review.get_by_text("2. g4")).to_be_visible()
                    black.reload()
                    expect(review.get_by_text("2… Qh4#")).to_be_visible()
                    expect(black.locator('[data-square="h4"] [role=img]')).to_have_attribute("aria-label", "black queen h4")
                    with black.expect_download() as exported:
                        black.get_by_role("link", name="Скачать PGN").click()
                    pgn_path = Path(directory) / "game.pgn"
                    exported.value.save_as(pgn_path)
                    self.assertIn("1. f3 e5 2. g4 Qh4# 0-1", pgn_path.read_text())
                    review.get_by_role("button", name="Назад").click()
                    black.get_by_role("link", name="Разобрать позицию").click()
                    black.locator('[data-square="d7"]').click()
                    black.locator('[data-square="d5"]').click()
                    expect(black.get_by_text("Вариант · d5")).to_be_visible()
                    black.get_by_role("button", name="Вернуться к исходной позиции").click()
                    expect(black.locator('[data-square="d7"] [role=img]')).to_have_count(1)
                    black.get_by_label("Файл PGN").set_input_files(pgn_path)
                    expect(black.get_by_text("Запись · f3 e5 g4 Qh4# 0-1")).to_be_visible()
                    expect(black.locator('[data-square="h4"] [role=img]')).to_have_count(1)
                    black.get_by_label("PGN или FEN").fill("7k/8/8/8/8/8/P7/R5K1 w - - 0 1")
                    black.get_by_role("button", name="Открыть FEN").click()
                    expect(black.locator('[data-square="a1"] [role=img]')).to_have_attribute("aria-label", "white rook a1")
                    black.get_by_label("PGN или FEN").fill("broken")
                    black.get_by_role("button", name="Открыть FEN").click()
                    expect(black.get_by_role("alert")).to_contain_text("Не удалось прочитать FEN")
                    black.get_by_role("link", name="Вернуться к партии").click()
                    expect(black.get_by_text("f3 e5 g4 Qh4#", exact=True)).to_be_visible()
                    original_url = white.url
                    white.get_by_role("button", name="Предложить реванш").click()
                    black.get_by_role("button", name="Принять реванш").click()
                    for player, first_square in [(white, "h1"), (black, "a8")]:
                        expect(player.get_by_role("link", name="Предыдущая партия")).to_be_visible()
                        expect(player.locator("[data-square]").first).to_have_attribute("data-square", first_square)
                        expect(player.get_by_label("Шахматные часы")).to_contain_text("3+0")
                    self.assertEqual(white.url, black.url)
                    black.locator('[data-square="e2"]').click()
                    black.locator('[data-square="e4"]').click()
                    expect(white.get_by_text("Ход чёрных")).to_be_visible()
                    white.get_by_role("link", name="Предыдущая партия").click()
                    expect(white).to_have_url(original_url)
                    expect(white.get_by_text("f3 e5 g4 Qh4#", exact=True)).to_be_visible()
                    expect(white.get_by_role("link", name="Открыть реванш")).to_be_visible()
                    white.get_by_role("link", name="Профиль").click()
                    record = white.get_by_role("link", name="Вы играли белыми", exact=False)
                    expect(record).to_contain_text("3+0 · 0-1 · Мат")
                    record.click()
                    expect(white).to_have_url(original_url)
                    third.get_by_role("link", name="Профиль").click()
                    expect(third.get_by_text("Завершённых партий пока нет")).to_be_visible()
                    white.get_by_role("link", name="Профиль").click()
                    white.get_by_role("button", name="Зарегистрироваться").click()
                    white.get_by_label("Имя игрока").fill("WhiteKnight")
                    white.get_by_label("Пароль").fill("test-password-w")
                    white.get_by_role("button", name="Создать аккаунт").click()
                    expect(white.get_by_role("heading", name="WhiteKnight")).to_be_visible()
                    third.get_by_label("Имя игрока").fill("whiteknight")
                    third.get_by_label("Пароль").fill("test-password-w")
                    third.get_by_role("button", name="Войти").click()
                    third.get_by_role("link", name="Вы играли белыми", exact=False).click()
                    expect(third).to_have_url(original_url)
                    expect(third.get_by_text("2… Qh4#")).to_be_visible()
                    third.get_by_role("link", name="Профиль").click()
                    third.get_by_role("button", name="Выйти").click()
                    expect(third.get_by_text("Завершённых партий пока нет")).to_be_visible()
                    for action, reason in [("Сдаться", "Сдача"), ("Принять ничью", "Ничья по соглашению")]:
                        white.goto(f"http://127.0.0.1:{port}")
                        white.get_by_role("button", name="Пригласить друга").click()
                        black.goto(white.get_by_label("Ссылка для соперника").input_value())
                        black.get_by_role("button", name="Играть за чёрных").click()
                        white.get_by_role("button", name="Предложить ничью").click()
                        if action == "Сдаться":
                            black.get_by_role("button", name="Отклонить ничью").click()
                        black.get_by_role("button", name=action).click()
                        expect(white.get_by_text(reason, exact=True)).to_be_visible()
                        black.reload()
                        expect(black.get_by_text(reason, exact=True)).to_be_visible()
                    page.goto(f"http://127.0.0.1:{port}")
                    page.get_by_role("button", name="Начать партию").tap()
                    cycle = ["g1f3", "g8f6", "f3g1", "f6g8"] * 2
                    for index, move in enumerate(cycle[:7]):
                        page.locator(f'[data-square="{move[:2]}"]').tap()
                        page.locator(f'[data-square="{move[2:]}"]').tap()
                        expect(page.get_by_text("Ход белых" if index % 2 else "Ход чёрных")).to_be_visible()
                    page.reload()
                    page.get_by_role("button", name="Заявить ничью · Троекратное повторение · f6–g8").tap()
                    expect(page.get_by_text("1/2-1/2", exact=True)).to_be_visible()
                    page.reload()
                    expect(page.get_by_text("Троекратное повторение", exact=True)).to_be_visible()
                    expect(page.get_by_text("Nf3 Nf6 Ng1 Ng8 Nf3 Nf6 Ng1", exact=True)).to_be_visible()
                    base = f"http://127.0.0.1:{port}"
                    def prepare(line):
                        game = page.request.post(base + "/api/games").json()
                        board = chess.Board()
                        for version, san in enumerate(line.split()):
                            move = board.push_san(san)
                            response = page.request.post(base + "/api/games/" + game["id"] + "/moves",
                                data={"version": version, "uci": move.uci(), "command_id": str(uuid4())})
                            self.assertTrue(response.ok)
                        page.goto(base + "/?game=" + game["id"])
                        expect(page.get_by_text("Ход белых", exact=True)).to_be_visible()

                    def tap_move(start, end):
                        page.locator(f'[data-square="{start}"]').tap()
                        page.locator(f'[data-square="{end}"]').tap()

                    prepare("e4 b6 Bc4 e6 Bb3 Ba6 Nf3 h6")
                    tap_move("e1", "g1")
                    expect(page.get_by_text("Ход белых", exact=True)).to_be_visible()
                    expect(page.locator('[data-square="e1"] [role=img]')).to_have_attribute("aria-label", "white king e1")
                    prepare("e4 a6 e5 d5")
                    tap_move("e5", "d6")
                    expect(page.get_by_text("Ход чёрных", exact=True)).to_be_visible()
                    expect(page.locator('[data-square="d5"] [role=img]')).to_have_count(0)
                    expect(page.locator('[data-square="d6"] [role=img]')).to_have_attribute("aria-label", "white pawn d6")
                    prepare("a4 h5 a5 h4 a6 h3 axb7 hxg2")
                    tap_move("b7", "a8")
                    page.get_by_role("button", name="Конь", exact=True).tap()
                    expect(page.locator('[data-square="a8"] [role=img]')).to_have_attribute("aria-label", "white knight a8")
                    prepare("e3 a5 Qh5 Ra6 Qxa5 h5 Qxc7 Rah6 h4 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6")
                    tap_move("c8", "e6")
                    expect(page.get_by_text("Пат", exact=True)).to_be_visible()
                    expect(page.get_by_text("1/2-1/2", exact=True)).to_be_visible()
                    for player in [white, black]:
                        player.goto(base)
                        player.get_by_role("button", name="5+0 Блиц").click()
                    white.get_by_role("button", name="Найти соперника").click()
                    white.get_by_role("button", name="Отменить поиск").click()
                    expect(white.get_by_role("button", name="Найти соперника")).to_be_visible()
                    white.get_by_role("button", name="Найти соперника").click()
                    expect(white.get_by_text("Ищем соперника · 5+0")).to_be_visible()
                    white.reload()
                    expect(white.get_by_text("Ищем соперника · 5+0")).to_be_visible()
                    black.get_by_role("button", name="Найти соперника").click()
                    for player in [white, black]:
                        expect(player.get_by_label("Шахматные часы")).to_contain_text("5+0")
                    self.assertEqual(white.url, black.url)
                    white.locator('[data-square="e2"]').click()
                    white.locator('[data-square="e4"]').click()
                    expect(black.get_by_text("Ход чёрных")).to_be_visible()
                    black.goto(base + "/?section=profile")
                    black.get_by_role("button", name="Зарегистрироваться").click()
                    black.get_by_label("Имя игрока").fill("BlackKnight")
                    black.get_by_label("Пароль").fill("test-password-b")
                    black.get_by_role("button", name="Создать аккаунт").click()
                    expect(black.get_by_role("heading", name="BlackKnight")).to_be_visible()
                    for player in (white, black):
                        player.goto(base)
                        player.get_by_label("Режим быстрого поиска").select_option("rated")
                        player.get_by_role("button", name="Найти соперника").click()
                        if player == white:
                            expect(white.get_by_role("button", name="Отменить поиск")).to_be_visible()
                    for player in (white, black):
                        expect(player.get_by_text("Рейтинговая игра", exact=True)).to_be_visible()
                    black.get_by_role("button", name="Сдаться").click()
                    expect(white.get_by_text("Сдача", exact=True)).to_be_visible()
                    for player, rating in [(white, 1516), (black, 1484)]:
                        player.goto(base + "/?section=profile")
                        expect(player.get_by_text(f"Блиц · {rating}", exact=True)).to_be_visible()
                    browser.close()
            finally:
                server.should_exit = True
                worker.join(timeout=10)


if __name__ == "__main__":
    main()
