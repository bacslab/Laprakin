from playwright.sync_api import sync_playwright


def check(page, viewport):
    page.set_viewport_size(viewport)
    page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
    page.wait_for_selector(".fg-page")
    assert page.locator(".fg-step-card").count() == 6
    assert page.locator(".fg-step-media img").count() == 6
    assert page.locator(".fg-step-media img").first.get_attribute("src").startswith("/landing/how-to/")
    feature = page.locator(".fg-feature-row article").first
    media = feature.locator(".fg-media-placeholder")
    assert feature.evaluate("node => getComputedStyle(node).padding") == "0px"
    assert media.evaluate("node => getComputedStyle(node).margin") == "0px"
    assert page.locator(".fg-hero-video").evaluate("node => getComputedStyle(node).transform") != "none"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    check(page, {"width": 1280, "height": 900})
    check(page, {"width": 390, "height": 844})
    browser.close()

print("landing responsive checks passed")
