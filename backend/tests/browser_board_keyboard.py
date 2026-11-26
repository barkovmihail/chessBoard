"""Run against the built app at CHESSBOARD_TEST_URL, as for browser_training."""
import os
import unittest

from playwright.sync_api import expect, sync_playwright


class BoardKeyboardTest(unittest.TestCase):
    def test_keyboard_moves_keep_focus(self):
        base = os.getenv("CHESSBOARD_TEST_URL", "http://127.0.0.1:8011")

        def square(page, coordinate):
            return page.locator(f'[data-square="{coordinate}"]')

        def play_pawn(page, origin, destination):
            square(page, origin).focus()
            page.keyboard.press("Space")
            expect(square(page, origin)).to_have_attribute("aria-pressed", "true")
            page.keyboard.press("ArrowUp")
            page.keyboard.press("ArrowUp")
            expect(square(page, destination)).to_be_focused()
            page.keyboard.press("Enter")
            expect(square(page, destination).locator("[data-sprite]")).to_be_visible()
            expect(square(page, destination)).to_be_focused()

        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
            white = browser.new_page(locale="ru-RU")
            white.goto(base)
            expect(white.locator("[data-square][tabindex='0']")).to_have_count(0)
            white.get_by_role("button", name="Пригласить друга").click()
            black = browser.new_page(locale="ru-RU")
            black.goto(white.get_by_label("Ссылка для соперника").input_value())
            black.get_by_role("button", name="Играть за чёрных").click()
            expect(white.get_by_text("Ход белых", exact=True)).to_be_visible()

            for page, entry, neighbor in ((white, "a8", "b8"), (black, "h1", "g1")):
                expect(page.locator("[data-square][tabindex='0']")).to_have_count(1)
                square(page, entry).focus()
                page.keyboard.press("ArrowLeft")
                expect(square(page, entry)).to_be_focused()
                page.keyboard.press("ArrowRight")
                expect(square(page, neighbor)).to_be_focused()
                page.keyboard.press("Tab")
                self.assertFalse(page.locator("[data-square]:focus").count())
                page.keyboard.press("Shift+Tab")
                expect(square(page, neighbor)).to_be_focused()

            play_pawn(white, "e2", "e4")
            expect(square(white, "e4")).to_have_attribute("aria-disabled", "true")
            white.keyboard.press("Space")
            expect(white.get_by_label("Запись ходов")).to_have_text("1. e4")
            play_pawn(black, "e7", "e5")
            expect(white.get_by_label("Запись ходов")).to_have_text("1. e4 e5")
            expect(square(white, "e4")).to_be_focused()
            square(white, "g1").drag_to(square(white, "f3"))
            expect(square(white, "f3")).to_have_accessible_name("f3, белый конь")
            square(black, "b8").click()
            square(black, "c6").click()
            expect(square(black, "c6")).to_have_accessible_name("c6, чёрный конь")

            white.goto(base + "/?section=analysis")
            play_pawn(white, "e2", "e4")
            expect(white.get_by_text("Вариант · e4", exact=True)).to_be_visible()
            white.get_by_label("PGN или FEN", exact=True).fill("7k/P7/8/8/8/8/8/6K1 w - - 0 1")
            white.get_by_role("button", name="Открыть FEN").click()
            square(white, "a7").focus()
            white.keyboard.press("Enter")
            white.keyboard.press("ArrowUp")
            white.keyboard.press("Enter")
            choices = white.get_by_role("group", name="Превращение пешки")
            expect(choices.get_by_role("button").first).to_be_focused()
            choices.get_by_role("button", name="Конь").focus()
            white.keyboard.press("Space")
            expect(square(white, "a8")).to_have_accessible_name("a8, белый конь")
            expect(square(white, "a8")).to_be_focused()
            browser.close()


if __name__ == "__main__":
    unittest.main()
