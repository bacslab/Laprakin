import json
import os

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("VISUAL_BASE_URL", "http://localhost:5173")
OUTPUT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "output"))
os.makedirs(OUTPUT_DIR, exist_ok=True)


def assert_auth_view(page, expected_theme):
    page.goto(f"{BASE_URL}/auth", wait_until="networkidle")
    page.locator(".auth-card").wait_for(state="visible")
    metrics = page.evaluate(
        """
        () => {
          const card = document.querySelector('.auth-card');
          const page = document.querySelector('.auth-page');
          const bounds = card.getBoundingClientRect();
          return {
            theme: page.classList.contains('theme-dark') ? 'dark' : 'light',
            htmlOverflow: document.documentElement.scrollHeight - window.innerHeight,
            bodyOverflow: document.body.scrollHeight - window.innerHeight,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
            pageBackground: getComputedStyle(page).backgroundColor,
            cardShadow: getComputedStyle(card).boxShadow,
            cardTop: bounds.top,
            cardBottom: bounds.bottom,
            viewportHeight: window.innerHeight,
          };
        }
        """
    )
    assert metrics["theme"] == expected_theme, metrics
    assert metrics["htmlOverflow"] <= 1, metrics
    assert metrics["bodyOverflow"] <= 1, metrics
    assert metrics["horizontalOverflow"] <= 1, metrics
    assert metrics["cardShadow"] == "none", metrics
    assert metrics["cardTop"] >= 0 and metrics["cardBottom"] <= metrics["viewportHeight"], metrics
    return metrics


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)

    dark_context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        color_scheme="dark",
    )
    dark_page = dark_context.new_page()
    dark_console_errors = []
    dark_page.on(
        "console",
        lambda message: dark_console_errors.append(message.text)
        if message.type == "error" and "401 (Unauthorized)" not in message.text
        else None,
    )
    dark_metrics = assert_auth_view(dark_page, "dark")
    dark_page.screenshot(path=os.path.join(OUTPUT_DIR, "auth-dark.png"), full_page=True)
    assert not dark_console_errors, dark_console_errors
    print("auth-dark-ok", flush=True)
    dark_context.close()

    light_context = browser.new_context(
        viewport={"width": 390, "height": 844},
        color_scheme="dark",
    )
    light_page = light_context.new_page()
    light_page.add_init_script(
        "localStorage.setItem('laprakin-preferences', JSON.stringify({ theme: 'light' }));"
    )
    light_metrics = assert_auth_view(light_page, "light")
    light_page.screenshot(path=os.path.join(OUTPUT_DIR, "auth-light-mobile.png"), full_page=True)
    light_page.set_viewport_size({"width": 390, "height": 667})
    light_page.get_by_role("button", name="Daftar", exact=True).click()
    light_page.wait_for_timeout(150)
    register_metrics = light_page.evaluate(
        """
        () => {
          const card = document.querySelector('.auth-card').getBoundingClientRect();
          return {
            htmlOverflow: document.documentElement.scrollHeight - window.innerHeight,
            bodyOverflow: document.body.scrollHeight - window.innerHeight,
            cardTop: card.top,
            cardBottom: card.bottom,
            viewportHeight: window.innerHeight,
          };
        }
        """
    )
    assert register_metrics["htmlOverflow"] <= 1, register_metrics
    assert register_metrics["bodyOverflow"] <= 1, register_metrics
    assert register_metrics["cardTop"] >= 0 and register_metrics["cardBottom"] <= register_metrics["viewportHeight"], register_metrics
    light_page.screenshot(path=os.path.join(OUTPUT_DIR, "auth-register-short.png"), full_page=True)
    print("auth-light-ok", flush=True)
    light_context.close()

    landing_context = browser.new_context(viewport={"width": 1440, "height": 1000})
    landing_page = landing_context.new_page()
    landing_console_errors = []
    landing_page.on(
        "console",
        lambda message: landing_console_errors.append(message.text)
        if message.type == "error" and "401 (Unauthorized)" not in message.text
        else None,
    )
    landing_page.goto(BASE_URL, wait_until="networkidle")
    landing_page.locator(".fg-hero-video").wait_for(state="visible")
    landing_page.wait_for_timeout(2400)
    hero_metrics = landing_page.evaluate(
        """
        () => {
          const hero = document.querySelector('.fg-hero').getBoundingClientRect();
          const media = document.querySelector('.fg-hero-video').getBoundingClientRect();
          return {
            mediaTop: media.top,
            mediaBottom: media.bottom,
            heroBottom: hero.bottom,
            mediaTransform: getComputedStyle(document.querySelector('.fg-hero-video')).transform,
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
          };
        }
        """
    )
    assert hero_metrics["mediaBottom"] <= hero_metrics["heroBottom"] + 2, hero_metrics
    assert hero_metrics["horizontalOverflow"] <= 1, hero_metrics
    landing_page.screenshot(path=os.path.join(OUTPUT_DIR, "landing-hero.png"), full_page=False)
    print("hero-ok", json.dumps(hero_metrics), flush=True)

    landing_page.locator(".fg-gradient-button").first.hover()
    landing_page.wait_for_timeout(300)
    cursor_metrics = landing_page.evaluate(
        """
        () => {
          const cursor = document.querySelector('.fg-cursor-orbit');
          return {
            display: getComputedStyle(cursor).display,
            opacity: getComputedStyle(cursor).opacity,
            width: cursor.getBoundingClientRect().width,
            label: document.querySelector('.fg-cursor-label').textContent,
          };
        }
        """
    )
    assert cursor_metrics["display"] == "grid", cursor_metrics
    assert float(cursor_metrics["opacity"]) > 0.9, cursor_metrics
    assert cursor_metrics["width"] >= 60, cursor_metrics
    assert cursor_metrics["label"] == "START", cursor_metrics
    assert not landing_console_errors, landing_console_errors
    print("cursor-ok", json.dumps(cursor_metrics), flush=True)

    landing_page.add_style_tag(
        content="""
        .fg-navbar, .fg-page main > section:not(.fg-sources), .fg-final-cta, .fg-footer { display:none !important; }
        .fg-sources { min-height:100vh; justify-content:center; padding-block:40px !important; }
        .fg-sources [data-aos] { opacity:1 !important; transform:none !important; }
        """
    )
    source_section = landing_page.locator(".fg-sources")
    source_section.wait_for(state="visible")
    source_buttons = landing_page.locator(".fg-source-stack button")
    assert source_buttons.count() == 4
    source_buttons.nth(2).locator(".fg-source-tab").hover()
    landing_page.wait_for_timeout(200)
    assert landing_page.locator(".fg-source-report h3").inner_text() == "Data pengujian"
    source_metrics = landing_page.evaluate(
        """
        () => ({
          oldLedgerCount: document.querySelectorAll('.fg-source-ledger').length,
          workbenchCount: document.querySelectorAll('.fg-source-workbench').length,
          horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
        })
        """
    )
    assert source_metrics["oldLedgerCount"] == 0, source_metrics
    assert source_metrics["workbenchCount"] == 1, source_metrics
    assert source_metrics["horizontalOverflow"] <= 1, source_metrics
    source_section.screenshot(path=os.path.join(OUTPUT_DIR, "landing-sources.png"))
    print("sources-ok", json.dumps(source_metrics), flush=True)

    landing_page.set_viewport_size({"width": 390, "height": 844})
    landing_page.wait_for_timeout(250)
    source_mobile_metrics = landing_page.evaluate(
        """
        () => {
          const report = document.querySelector('.fg-source-report').getBoundingClientRect();
          return {
            horizontalOverflow: document.documentElement.scrollWidth - window.innerWidth,
            columns: getComputedStyle(document.querySelector('.fg-source-stage')).gridTemplateColumns,
            reportRight: report.right,
            viewportWidth: window.innerWidth,
          };
        }
        """
    )
    assert source_mobile_metrics["horizontalOverflow"] <= 1, source_mobile_metrics
    assert source_mobile_metrics["reportRight"] <= source_mobile_metrics["viewportWidth"] + 1, source_mobile_metrics
    source_section.screenshot(path=os.path.join(OUTPUT_DIR, "landing-sources-mobile.png"))
    print("sources-mobile-ok", json.dumps(source_mobile_metrics), flush=True)
    landing_context.close()

    browser.close()
    print(json.dumps({
        "authDark": dark_metrics,
        "authLightMobile": light_metrics,
        "authRegisterShort": register_metrics,
        "hero": hero_metrics,
        "cursor": cursor_metrics,
        "sources": source_metrics,
        "sourcesMobile": source_mobile_metrics,
    }, ensure_ascii=False))
