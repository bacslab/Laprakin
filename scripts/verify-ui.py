from playwright.sync_api import sync_playwright


def check(page, viewport):
    page.set_viewport_size(viewport)
    page.goto("http://127.0.0.1:5173/", wait_until="networkidle")
    page.wait_for_selector(".fg-page")
    assert page.locator(".fg-step-card").count() == 6
    assert page.locator(".fg-step-media img").count() == 6
    step_image = page.locator(".fg-step-media img").first
    step_media = page.locator(".fg-step-media").first
    assert step_image.get_attribute("src").startswith("/landing/how-to/")
    page.wait_for_function("document.querySelector('.fg-step-media img')?.naturalWidth > 0")
    natural_ratio = step_image.evaluate("node => node.naturalWidth / node.naturalHeight")
    rendered_ratio = step_media.evaluate("node => node.getBoundingClientRect().width / node.getBoundingClientRect().height")
    assert abs(natural_ratio - (105 / 109)) < 0.002
    assert abs(rendered_ratio - natural_ratio) < 0.01
    assert step_image.evaluate("node => getComputedStyle(node).objectFit") == "contain"
    feature = page.locator(".fg-feature-row article").first
    media = feature.locator(".fg-media-placeholder")
    assert feature.evaluate("node => getComputedStyle(node).padding") == "0px"
    assert media.evaluate("node => getComputedStyle(node).margin") == "0px"
    rows = feature.evaluate("node => getComputedStyle(node).gridTemplateRows.split(' ').map(parseFloat)")
    assert 3.95 <= rows[1] / rows[0] <= 4.05
    assert page.locator(".fg-hero-video").evaluate("node => getComputedStyle(node).transform") != "none"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    check(page, {"width": 1280, "height": 900})
    check(page, {"width": 390, "height": 844})
    browser.close()

print("landing responsive checks passed")
