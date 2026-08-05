from playwright.sync_api import sync_playwright


def check(page, viewport):
    page.set_viewport_size(viewport)
    page.goto("http://localhost:5173/", wait_until="networkidle")
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
    assert 459 <= feature.bounding_box()["height"] <= 461
    assert feature.locator(".fg-feature-copy span").count() == 0
    assert float(feature.locator(".fg-feature-copy").evaluate("node => parseFloat(getComputedStyle(node).paddingLeft)")) >= 26
    assert page.locator(".fg-hero-video").evaluate("node => getComputedStyle(node).transform") != "none"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    if viewport["width"] <= 700:
        lines = page.locator(".fg-statement-line")
        assert lines.count() == 6
        assert all(line.evaluate("node => getComputedStyle(node).whiteSpace") == "nowrap" for line in lines.all())
        page.locator("#cara-pakai").scroll_into_view_if_needed()
        card_box = page.locator(".fg-step-card.is-active").bounding_box()
        controls_box = page.locator(".fg-step-controls").bounding_box()
        assert card_box and card_box["width"] <= 321 and controls_box and controls_box["y"] > card_box["y"] + card_box["height"]
        assert float(page.locator(".fg-step-card.is-active").evaluate("node => parseFloat(getComputedStyle(node).paddingTop)")) >= 19
        page.locator(".fg-footer").scroll_into_view_if_needed()
        hills = page.locator(".fg-footer-hills img").bounding_box()
        hills_style = page.locator(".fg-footer-hills img").evaluate("node => ({ opacity: getComputedStyle(node).opacity, bottom: getComputedStyle(node).bottom })")
        assert hills and hills["height"] > 0 and hills_style["opacity"] == "1" and hills_style["bottom"] == "70px"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    check(page, {"width": 1280, "height": 900})
    check(page, {"width": 390, "height": 844})
    browser.close()

print("landing responsive checks passed")
