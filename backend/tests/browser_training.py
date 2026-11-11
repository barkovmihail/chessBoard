"""Run against the web app with a loaded puzzle catalogue on CHESSBOARD_TEST_URL."""
import os
import unittest

import chess
from playwright.sync_api import expect, sync_playwright


class TrainingTest(unittest.TestCase):
    def test_openings_and_puzzle(self):
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
            page = browser.new_page(viewport={"width": 390, "height": 844}, has_touch=True)
            page.goto(os.getenv("CHESSBOARD_TEST_URL", "http://127.0.0.1:8011"))
            page.get_by_role("link", name="Тренажёр дебютов").click()

            def check_layout():
                for width in (360, 768, 1440):
                    page.set_viewport_size({"width": width, "height": 900})
                    cell = page.locator("[data-square]").first.bounding_box()
                    action = page.get_by_role("button", name="Начать заново").bounding_box()
                    self.assertAlmostEqual(cell["width"], cell["height"], delta=1)
                    self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
                    if width > 680:
                        self.assertGreater(action["x"], cell["x"] + 7 * cell["width"])
                    else:
                        self.assertGreater(action["y"], cell["y"] + 7 * cell["height"])
                page.set_viewport_size({"width": 390, "height": 844})

            check_layout()

            def move(uci):
                for square in [uci[:2], uci[2:4]]:
                    page.locator(f'[data-square="{square}"]').tap()
                if len(uci) == 5:
                    names = {"q": "Ферзь", "r": "Ладья", "b": "Слон", "n": "Конь"}
                    page.get_by_role("button", name=names[uci[4]]).click()

            def touch_drag(start, end):
                session = page.context.new_cdp_session(page)
                try:
                    for phase, square in [("touchStart", start), ("touchMove", end)]:
                        cell = page.locator(f'[data-square="{square}"]')
                        cell.scroll_into_view_if_needed()
                        box = cell.bounding_box()
                        session.send("Input.dispatchTouchEvent", {"type": phase, "touchPoints": [{
                            "x": box["x"] + box["width"] / 2, "y": box["y"] + box["height"] / 2,
                        }]})
                    session.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
                finally:
                    session.detach()

            page.emulate_media(reduced_motion="reduce")
            expect(page.get_by_label("Дебют", exact=True)).to_be_hidden()
            expect(page.get_by_text("Итальянская партия · 0/7")).to_be_visible()
            touch_drag("e2", "e5")
            expect(page.get_by_text("Так пойти нельзя.", exact=False)).to_be_visible()
            move("d2d4")
            expect(page.get_by_text("Допустимый ход", exact=False)).to_be_visible()
            page.get_by_role("button", name="Показать ход").click()
            expect(page.locator('[data-square="e4"]')).to_have_attribute("data-target", "true")

            for index, sequence in enumerate([
                "e2e4 g1f3 f1c4 c2c3", "e2e4 g1f3 f1b5 b5a4", "d2d4 c2c4 b1c3 c1g5",
                "c7c5 d7d6 c5d4 g8f6", "e7e6 d7d5 c7c5 b8c6",
            ]):
                chooser = page.get_by_label("Дебют", exact=True)
                if not chooser.is_visible():
                    page.get_by_text("Выбрать дебют", exact=True).tap()
                chooser.select_option(index=index)
                for uci in sequence.split():
                    if index == 0 and uci == "e2e4":
                        square = page.locator('[data-square="e4"]')
                        top = square.evaluate("el => el.getBoundingClientRect().top + window.scrollY")
                        touch_drag("e2", "e4")
                        expect(page.locator('[data-square="e5"] [role="img"]')).to_be_visible()
                        self.assertAlmostEqual(top, square.evaluate("el => el.getBoundingClientRect().top + window.scrollY"), delta=1)
                        expect(page.get_by_text("Ответ e5.", exact=False)).to_be_visible()
                        page.get_by_role("button", name="Показать ход").tap()
                        expect(page.locator('[data-square="e5"]')).to_have_attribute("data-last-move", "true")
                        expect(page.locator('[data-square="f3"]')).to_have_attribute("data-target", "true")
                    elif uci == "e2e4":
                        touch_drag("e2", "e4")
                    else:
                        move(uci)
                expect(page.get_by_role("heading", name="Линия пройдена")).to_be_visible()

            link = page.get_by_role("link", name="Ссылка на главу")
            self.assertEqual(link.get_attribute("href"), "?section=openings&chapter=french-defense")
            reader = browser.new_page()
            reader.goto(page.url.split("?")[0] + link.get_attribute("href"))
            expect(reader.get_by_label("Дебют", exact=True)).to_have_value("french-defense")
            reader.get_by_label("Дебют", exact=True).select_option("queens-gambit")
            reader.wait_for_url("**/*chapter=queens-gambit")
            reader.reload()
            expect(reader.get_by_label("Дебют", exact=True)).to_have_value("queens-gambit")
            reader.go_back()
            expect(reader.get_by_label("Дебют", exact=True)).to_have_value("french-defense")
            reader.get_by_label("Меню профиля").click()
            reader.get_by_text("Язык (Language)", exact=True).click()
            reader.get_by_role("radio", name="English").check()
            reader.keyboard.press("Escape")
            expect(reader.get_by_label("Opening", exact=True)).to_have_value("french-defense")
            expect(reader.get_by_text("Reply e4. White opens a diagonal for the king’s bishop.")).to_be_visible()
            reader.get_by_role("button", name="Show move").click()
            expect(reader.get_by_text("e6 · e7 → e6. The pawn prepares the d7–d5 advance.")).to_be_visible()
            reader.get_by_role("link", name="Create chapter").click()
            reader.get_by_label("Chapter title").fill("Центральные пешки")
            reader.get_by_label("Line 1", exact=True).fill("e5")
            reader.get_by_role("button", name="Save chapter").click()
            expect(reader.get_by_role("alert")).to_contain_text("half-move 1")
            reader.get_by_label("Line 1", exact=True).fill("e4 | Занимаем центр")
            reader.get_by_role("button", name="Add line").click()
            reader.get_by_label("Line 2", exact=True).fill("d4 | Контролируем e5")
            reader.get_by_role("button", name="Save chapter").click()
            expect(reader.get_by_role("heading", name="Центральные пешки")).to_be_visible()
            student = browser.new_page(viewport={"width": 390, "height": 844})
            student.goto(reader.url)
            expect(student.get_by_label("Учебный вариант")).to_be_hidden()
            student.get_by_text("Выбрать вариант", exact=True).click()
            student.get_by_label("Учебный вариант").select_option("1")
            student.locator('[data-square="d2"]').click()
            student.locator('[data-square="d4"]').click()
            expect(student.get_by_role("heading", name="Линия пройдена")).to_be_visible()
            expect(student.get_by_text("Верно, d4. Контролируем e5")).to_be_visible()
            student.close()
            reader.close()
            with page.expect_response(lambda res: "/api/puzzles/random" in res.url) as fetched:
                page.get_by_role("link", name="Шахматные задачи").click()
            check_layout()
            self.assertEqual(fetched.value.status, 200)
            expect(page.get_by_label("Тема задачи")).to_be_hidden()
            page.get_by_text("Выбор темы · Все темы", exact=True).click()
            with page.expect_response(lambda res: "theme=fork" in res.url) as themed:
                page.get_by_label("Тема задачи").select_option("fork")
            self.assertIn("fork", themed.value.json()["themes"])
            with page.expect_response(lambda res: "theme=fork" in res.url) as following:
                page.get_by_role("button", name="Следующая задача").click()
            puzzle = following.value.json()
            self.assertIn("fork", puzzle["themes"])
            expect(page.get_by_text("Задача " + puzzle["puzzle_id"], exact=False)).to_be_visible()
            board = chess.Board(puzzle["fen"])
            board.push_uci(puzzle["moves"][0])
            source = puzzle["moves"][1][:2]
            expect(page.locator('[data-target="true"]')).to_have_count(0)
            expect(page.get_by_text("Выбор темы · Вилка", exact=True)).to_be_visible()
            illegal = next(chess.square_name(sq) for sq in chess.SQUARES
                           if not board.piece_at(sq) and not any(m.from_square == chess.parse_square(source)
                           and m.to_square == sq for m in board.legal_moves))
            move(source + illegal)
            expect(page.get_by_text("Так пойти нельзя.", exact=False)).to_be_visible()
            page.get_by_text("История попыток", exact=True).click()
            expect(page.get_by_role("listitem").filter(has_text="Не завершена · Ошибок 1")).to_be_visible()
            page.get_by_label("Меню профиля").click()
            page.get_by_text("Язык (Language)", exact=True).click()
            page.get_by_role("radio", name="English").check()
            page.keyboard.press("Escape")
            expect(page.get_by_text("That move is illegal. Try again.")).to_be_visible()
            expect(page.get_by_label("Puzzle theme")).to_have_value("fork")
            expect(page.get_by_role("listitem").filter(has_text="Unfinished · Mistakes 1")).to_be_visible()
            page.get_by_role("button", name="Show move").click()
            expect(page.locator(f'[data-square="{source}"]')).to_have_attribute("data-target", "true")
            page.get_by_label("Profile menu").click()
            page.get_by_text("Language", exact=True).click()
            page.get_by_role("radio", name="Español").check()
            page.keyboard.press("Escape")
            expect(page.get_by_text("Esa jugada es ilegal. Inténtalo de nuevo.")).to_be_visible()
            expect(page.get_by_label("Tema del problema")).to_have_value("fork")
            expect(page.get_by_text(f"Problema {puzzle['puzzle_id']} · Puntuación", exact=False)).to_be_visible()
            expect(page.locator(f'[data-square="{source}"]')).to_have_attribute("data-target", "true")
            expect(page.get_by_role("listitem").filter(has_text="Sin terminar · Errores 1")).to_be_visible()
            page.get_by_label("Menú de perfil").click()
            page.get_by_text("Idioma", exact=True).click()
            page.get_by_role("radio", name="Русский").check()
            page.keyboard.press("Escape")
            board.pop()
            for ply, uci in enumerate(puzzle["moves"]):
                board.push_uci(uci)
                if ply % 2:
                    move(uci)
            expect(page.get_by_role("heading", name="Задача решена")).to_be_visible()
            result = page.get_by_role("listitem").filter(has_text=f"Задача {puzzle['puzzle_id']} · Решена · Ошибок 1")
            expect(result).to_be_visible()
            with page.expect_response(lambda res: "theme=fork" in res.url):
                page.get_by_role("button", name="Следующая задача").tap()
            expect(page.get_by_role("heading", name="Ваш ход")).to_be_visible()
            expect(page.locator('[data-target="true"]')).to_have_count(0)
            page.reload()
            expect(page.get_by_role("button", name="Начать заново")).to_be_visible()
            page.get_by_text("История попыток", exact=True).click()
            expect(result).to_be_visible()
            browser.close()


if __name__ == "__main__":
    unittest.main()
