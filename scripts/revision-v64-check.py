from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"


def assert_no_horizontal_overflow(page):
    assert page.evaluate("document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    desktop = browser.new_page(viewport={"width": 1440, "height": 900})
    desktop.goto(f"{BASE_URL}/", wait_until="networkidle")
    feature_images = desktop.locator(".fg-feature-image")
    assert feature_images.count() == 4
    for index in range(feature_images.count()):
        box = feature_images.nth(index).bounding_box()
        assert box and abs((box["width"] / box["height"]) - 1.5) < 0.01
    assert_no_horizontal_overflow(desktop)

    mobile = browser.new_page(viewport={"width": 390, "height": 844})
    mobile.goto(f"{BASE_URL}/", wait_until="networkidle")
    mobile_images = mobile.locator(".fg-feature-image")
    assert mobile_images.count() == 4
    for index in range(mobile_images.count()):
        box = mobile_images.nth(index).bounding_box()
        assert box and abs((box["width"] / box["height"]) - 1.5) < 0.01
    assert_no_horizontal_overflow(mobile)

    auth = browser.new_page(viewport={"width": 390, "height": 844})
    auth.goto(f"{BASE_URL}/auth", wait_until="networkidle")
    divider = auth.locator(".auth-divider")
    assert auth.locator(".auth-card").count() == 1
    if divider.count():
        assert auth.locator(".auth-divider span").inner_text() == "atau gunakan email"
        assert auth.locator(".auth-divider").evaluate("element => getComputedStyle(element).backgroundColor") in ("rgba(0, 0, 0, 0)", "transparent")
    assert_no_horizontal_overflow(auth)

    privacy = browser.new_page(viewport={"width": 390, "height": 844})
    privacy.goto(f"{BASE_URL}/privacy", wait_until="networkidle")
    assert privacy.locator(".legal-sections section").count() >= 12
    assert "hanya diproses untuk" in privacy.locator(".legal-document > header p").inner_text()
    assert_no_horizontal_overflow(privacy)

    terms = browser.new_page(viewport={"width": 390, "height": 844})
    terms.goto(f"{BASE_URL}/terms", wait_until="networkidle")
    assert terms.locator(".legal-sections section").count() >= 12
    assert_no_horizontal_overflow(terms)

    browser.close()

print("revision v64 browser checks passed")
