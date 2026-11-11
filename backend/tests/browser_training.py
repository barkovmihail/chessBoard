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
                page.get_by_label("Дебют", exact=True).select_option(str(index))
                for uci in sequence.split():
                    if uci == "e2e4":
                        touch_drag("e2", "e4")
                    else:
                        move(uci)
                expect(page.get_by_role("heading", name="Линия пройдена")).to_be_visible()

            with page.expect_response(lambda res: "/api/puzzles/random" in res.url) as fetched:
                page.get_by_role("link", name="Шахматные задачи").click()
            check_layout()
            self.assertEqual(fetched.value.status, 200)
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
            illegal = next(chess.square_name(sq) for sq in chess.SQUARES
                           if not board.piece_at(sq) and not any(m.from_square == chess.parse_square(source)
                           and m.to_square == sq for m in board.legal_moves))
            move(source + illegal)
            expect(page.get_by_text("Так пойти нельзя.", exact=False)).to_be_visible()
            page.get_by_text("История попыток", exact=True).click()
            expect(page.get_by_role("listitem").filter(has_text="Не завершена · Ошибок 1")).to_be_visible()
            board.pop()
            for ply, uci in enumerate(puzzle["moves"]):
                board.push_uci(uci)
                if ply % 2:
                    move(uci)
            expect(page.get_by_role("heading", name="Задача решена")).to_be_visible()
            result = page.get_by_role("listitem").filter(has_text=f"Задача {puzzle['puzzle_id']} · Решена · Ошибок 1")
            expect(result).to_be_visible()
            page.reload()
            expect(page.get_by_role("button", name="Начать заново")).to_be_visible()
            page.get_by_text("История попыток", exact=True).click()
            expect(result).to_be_visible()
            browser.close()


if __name__ == "__main__":
    unittest.main()
