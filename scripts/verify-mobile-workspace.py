import time

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:5173"
stamp = int(time.time() * 1000)
email = f"mobile-ui-{stamp}@example.test"
password = "KataSandi-Mobile-2026"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        extra_http_headers={"x-laprakin-device": f"mobile-ui-{stamp}"},
    )

    for _ in range(80):
        try:
            if context.request.get(f"{BASE_URL}/api/health").ok:
                break
        except Exception:
            pass
        time.sleep(0.1)
    else:
        raise AssertionError("API tidak siap")

    registration = context.request.post(
        f"{BASE_URL}/api/auth/register",
        data={"email": email, "password": password},
    )
    assert registration.status == 201, registration.text()
    verification = context.request.post(
        f"{BASE_URL}/api/auth/verify",
        data={"token": registration.json()["developmentVerificationToken"]},
    )
    assert verification.ok, verification.text()
    csrf = verification.json()["csrfToken"]
    csrf_headers = {"x-laprakin-csrf": csrf}

    onboarding = context.request.post(
        f"{BASE_URL}/api/profile/onboarding",
        headers=csrf_headers,
        data={"dismissed": True},
    )
    assert onboarding.ok, onboarding.text()
    session = context.request.post(
        f"{BASE_URL}/api/chat/sessions",
        headers=csrf_headers,
        data={
            "title": "Penyusunan Laporan Praktikum Routing Protocol",
            "configuration": {"courseName": "Jaringan Komputer", "allowExternalAi": True},
        },
    )
    assert session.status == 201, session.text()

    page = context.new_page()
    page.add_init_script(
        """
        localStorage.setItem('laprakin-preferences', JSON.stringify({
          theme: 'light', accent: 'lime', compact: true, reducedMotion: false,
          language: 'id', productUpdates: false, allowExternalAi: true
        }));
        """
    )
    page.goto(f"{BASE_URL}/app/projects", wait_until="networkidle")
    page.locator(".projects-page").wait_for()

    hamburger = page.get_by_role("button", name="Buka navigasi")
    heading = page.locator(".projects-header h1")
    positions = page.evaluate(
        """() => {
          const menu = document.querySelector('.mobile-nav-toggle').getBoundingClientRect();
          const title = document.querySelector('.projects-header h1').getBoundingClientRect();
          return { menuBottom: menu.bottom, titleTop: title.top };
        }"""
    )
    assert positions["menuBottom"] <= positions["titleTop"], positions
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")

    hamburger.click()
    page.wait_for_timeout(320)
    sidebar_transform = page.locator(".left-sidebar").evaluate(
        "node => getComputedStyle(node).transform"
    )
    assert sidebar_transform in ("none", "matrix(1, 0, 0, 1, 0, 0)"), sidebar_transform

    row = page.locator(".session-row").first
    row.wait_for()
    centers = row.evaluate(
        """node => {
          const open = node.querySelector('.session-open').getBoundingClientRect();
          const actions = node.querySelector('.session-row-actions').getBoundingClientRect();
          const box = node.getBoundingClientRect();
          return {
            row: box.top + box.height / 2,
            open: open.top + open.height / 2,
            actions: actions.top + actions.height / 2,
          };
        }"""
    )
    assert abs(centers["row"] - centers["open"]) <= 1, centers
    assert abs(centers["row"] - centers["actions"]) <= 1, centers

    page.get_by_role("button", name="Settings", exact=True).click()
    settings_nav = page.locator(".settings-nav-list")
    settings_nav.wait_for()
    assert settings_nav.get_by_role("button").count() == 12
    nav_box = settings_nav.evaluate(
        "node => ({ height: node.getBoundingClientRect().height, visible: getComputedStyle(node).display })"
    )
    assert nav_box["height"] >= 36 and nav_box["visible"] == "flex", nav_box
    keyboard_tab = settings_nav.get_by_role("button", name="Keyboard")
    keyboard_tab.scroll_into_view_if_needed()
    keyboard_tab.click()
    assert page.get_by_role("heading", name="Interaksi dan gerakan").is_visible()

    page.get_by_role("button", name="Tutup settings").click()
    page.get_by_role("button", name="Tutup navigasi").click()
    page.goto(f"{BASE_URL}/app", wait_until="networkidle")
    ai_trigger = page.locator(".ai-mode-trigger")
    ai_trigger.wait_for()
    assert page.get_by_role("button", name="Voice input").count() == 0
    trigger_box = ai_trigger.evaluate(
        "node => ({ width: node.getBoundingClientRect().width, height: node.getBoundingClientRect().height })"
    )
    assert trigger_box["height"] <= 30.5 and trigger_box["width"] < 80, trigger_box
    ai_trigger.click()
    popover_box = page.locator(".ai-mode-popover").evaluate(
        "node => ({ width: node.getBoundingClientRect().width, option: node.querySelector('button').getBoundingClientRect().height })"
    )
    assert popover_box["width"] <= 252.5 and popover_box["option"] <= 44.5, popover_box

    accent = page.locator(".workspace").evaluate(
        """node => ({
          key: node.dataset.accent,
          accent: getComputedStyle(node).getPropertyValue('--workspace-accent').trim(),
          ink: getComputedStyle(node).getPropertyValue('--workspace-accent-ink').trim(),
          transition: getComputedStyle(node.querySelector('.left-sidebar')).transitionDuration,
        })"""
    )
    assert accent["key"] == "lime", accent
    assert accent["accent"] == "#c2ff33" and accent["ink"] == "#4d7000", accent
    assert accent["transition"] != "0s", accent

    deletion = context.request.delete(
        f"{BASE_URL}/api/me",
        headers=csrf_headers,
        data={"confirmation": email},
    )
    assert deletion.ok, deletion.text()
    browser.close()

print("mobile workspace checks passed")
