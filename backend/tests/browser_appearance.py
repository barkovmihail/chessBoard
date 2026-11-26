"""Run against a built app at CHESSBOARD_TEST_URL, as for browser_training."""
import os
import unittest

from playwright.sync_api import expect, sync_playwright


class AppearanceTest(unittest.TestCase):
    def test_keyboard_navigation_and_language(self):
        base = os.getenv("CHESSBOARD_TEST_URL", "http://127.0.0.1:8011")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
            page = browser.new_page(locale="en-US", viewport={"width": 390, "height": 844})
            page.goto(base + "/?section=analysis#import")
            expect(page.locator("html")).to_have_attribute("lang", "en")
            page.keyboard.press("Tab")
            expect(page.get_by_role("link", name="Skip to content")).to_be_focused()
            page.keyboard.press("Enter")
            expect(page.locator("#main-content")).to_be_focused()
            self.assertTrue(page.url.endswith("#import"))

            games = page.get_by_role("button", name="Challenges and current games")
            notices = page.get_by_role("button", name="Notifications")
            games.click()
            expect(games).to_have_attribute("aria-expanded", "true")
            notices.click()
            expect(games).to_have_attribute("aria-expanded", "false")
            expect(notices).to_have_attribute("aria-expanded", "true")
            page.keyboard.press("Tab")
            page.keyboard.press("Escape")
            expect(notices).to_be_focused()
            expect(notices).to_have_attribute("aria-expanded", "false")

            menu = page.get_by_label("Profile menu", exact=True)
            menu.click()
            page.get_by_text("Language", exact=True).click()
            page.get_by_role("radio", name="Español").check()
            page.reload()
            expect(page.locator("html")).to_have_attribute("lang", "es")
            browser.close()

    def test_persistent_theme_across_sections(self):
        base = os.getenv("CHESSBOARD_TEST_URL", "http://127.0.0.1:8011")
        routes = ("", "analysis", "analysis#import", "openings", "openings&chapter=new",
                  "openings&review=today", "puzzles", "puzzles&view=history", "arenas", "chat",
                  "messages", "teams", "profile", "profile&view=history", "profile&view=progress",
                  "profile&view=account", "profile&settings=1#notification-settings", "settings", "inbox", "feed")
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(channel=os.getenv("BROWSER_CHANNEL") or None)
            context = browser.new_context(locale="ru-RU", viewport={"width": 1440, "height": 940})
            page = context.new_page()
            errors = []
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.goto(base)
            switch = page.get_by_role("button", name="Тёмная тема", exact=True)
            for theme, background in (("light", "rgb(244, 241, 234)"), ("dark", "rgb(33, 30, 37)")):
                if theme == "dark":
                    switch.click()
                for route in routes:
                    with self.subTest(theme=theme, route=route):
                        page.goto(base + ("/?section=" + route if route else "/"))
                        expect(page.get_by_role("heading", level=1).first).to_be_visible()
                        expect(page.locator("body")).to_have_css("background-color", background)
                        expect(switch).to_have_attribute("aria-pressed", str(theme == "dark").lower())
                        for width in (360, 768, 1440):
                            page.set_viewport_size({"width": width, "height": 940})
                            self.assertTrue(page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width)
            page.goto(base + "/?section=settings")
            other = context.new_page()
            other.goto(base + "/?section=chat")
            page.get_by_role("radio", name="Светлая").check()
            expect(other.locator("html")).to_have_attribute("data-theme", "light")
            page.reload()
            expect(page.get_by_role("radio", name="Светлая")).to_be_checked()
            self.assertEqual(errors, [])
            browser.close()


if __name__ == "__main__":
    unittest.main()
