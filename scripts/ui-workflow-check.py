import os
import time

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:5173"
DEVICE_ID = f"ui-workflow-{int(time.time() * 1000)}"
TEST_IP = f"198.18.{int(time.time()) % 200}.10"
SCREENSHOT_PATH = os.getenv(
    "LAPRAKIN_UI_SCREENSHOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "output", "playwright", "laprakin-workflow-final.png")),
)


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        extra_http_headers={
            "x-laprakin-device": DEVICE_ID,
            "x-laprakin-client-profile": DEVICE_ID,
            "x-forwarded-for": TEST_IP,
        }
    )
    registration = context.request.post(
        f"{BASE_URL}/api/auth/register",
        data={
            "email": f"{DEVICE_ID}@example.test",
            "password": "KataSandi-Uji-2026",
        },
    )
    assert registration.status == 201, f"{registration.status}: {registration.text()}"
    verification_token = registration.json()["developmentVerificationToken"]
    verification = context.request.post(
        f"{BASE_URL}/api/auth/verify",
        data={"token": verification_token},
    )
    assert verification.ok, verification.text()

    page = context.new_page()
    browser_errors = []
    page.on("pageerror", lambda error: browser_errors.append(str(error)))
    page.goto(f"{BASE_URL}/app", wait_until="networkidle")
    try:
        page.locator(".product-update-close").wait_for(timeout=2500)
        page.locator(".product-update-close").click()
    except Exception:
        pass
    page.locator(".composer textarea").wait_for()
    assert page.locator(".identity-intake-modal").count() == 0

    page.locator(".workspace-tutorial").wait_for()
    assert page.get_by_text("Langkah 1 dari 4").is_visible()
    assert page.locator(".workspace-tutorial video").count() == 1
    assert page.get_by_role("button", name="Sebelumnya").is_disabled()
    page.get_by_role("button", name="Lanjut", exact=True).click()
    assert page.get_by_text("Langkah 2 dari 4").is_visible()
    page.get_by_role("button", name="Sebelumnya").click()
    assert page.get_by_text("Langkah 1 dari 4").is_visible()
    for expected_step in (2, 3, 4):
        page.get_by_role("button", name="Lanjut", exact=True).click()
        assert page.get_by_text(f"Langkah {expected_step} dari 4").is_visible()
    page.get_by_role("button", name="Mulai chat").click()
    page.locator(".workspace-tutorial").wait_for(state="detached")

    page.get_by_role("button", name="Tinjau dan izinkan", exact=True).click()
    page.get_by_role("button", name="Tinjau dan izinkan", exact=True).wait_for(state="detached")
    composer = page.locator(".composer textarea")
    composer.fill("Uji Shift Enter")
    composer.press("Shift+Enter")
    assert composer.input_value() == "Uji Shift Enter\n"
    composer.dispatch_event("keydown", {"key": "Enter", "isComposing": True})
    assert context.request.get(f"{BASE_URL}/api/chat/sessions").json()["sessions"] == []
    composer.fill("")

    page.get_by_role("button", name="Settings", exact=True).click()
    page.get_by_role("button", name="Keyboard", exact=True).click()
    page.get_by_label("Enter untuk kirim", exact=True).set_checked(False)
    page.get_by_role("button", name="Tutup settings").click()

    page.evaluate(
        """() => {
          const target = document.querySelector('.chat-surface');
          const transfer = new DataTransfer();
          transfer.items.add(new File(
            ['Instruksi praktikum static routing dan langkah konfigurasi router.'],
            'Modul Routing.txt',
            { type: 'text/plain' }
          ));
          target.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }));
          target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
        }"""
    )
    page.locator(".pending-file-chip").wait_for()
    page.locator(".toast").wait_for()
    light_toast_colors = page.locator(".toast").evaluate(
        "(node) => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })"
    )
    assert light_toast_colors["background"] == "rgb(23, 25, 23)", light_toast_colors
    assert light_toast_colors["color"] == "rgb(255, 255, 255)", light_toast_colors
    sessions_before_send = context.request.get(f"{BASE_URL}/api/chat/sessions").json()
    assert sessions_before_send["sessions"] == []

    page.locator(".composer textarea").fill("Gunakan bahan ini untuk laprak saya.")
    page.locator(".composer textarea").press("Enter")
    assert page.locator(".composer textarea").input_value().endswith("\n")
    assert context.request.get(f"{BASE_URL}/api/chat/sessions").json()["sessions"] == []
    page.locator(".composer textarea").dispatch_event(
        "keydown", {"key": "Enter", "ctrlKey": True, "isComposing": True}
    )
    assert context.request.get(f"{BASE_URL}/api/chat/sessions").json()["sessions"] == []
    page.locator(".composer textarea").press("Control+Enter")
    page.locator(".identity-intake-modal").wait_for(state="detached")
    page.locator(".message.user").wait_for()
    assert page.get_by_text("Lengkapi identitas laprakmu").count() == 0
    page.locator(".message.user").wait_for()
    assert "Gunakan bahan ini" in page.locator(".message.user").inner_text()
    assert page.locator(".first-use-guidance").count() == 0
    page.locator(".clarification-inline").wait_for(timeout=30000)
    assert page.get_by_role("button", name="Kirim pesan").is_visible()
    assert page.locator(".pending-file-chip").count() == 0
    assert page.locator(".source-bar").is_visible()
    assert page.locator(".work-plan-rail").count() == 0
    active_session_id = context.request.get(f"{BASE_URL}/api/chat/sessions").json()["sessions"][0]["id"]
    active_payload = context.request.get(f"{BASE_URL}/api/chat/sessions/{active_session_id}").json()
    assert len(active_payload["attachments"]) == 1

    clarification = page.locator(".clarification-inline")
    clarification.locator("label").nth(0).locator("input").fill("Jaringan Komputer")
    clarification.locator("label").nth(1).locator("input").fill("Static Routing")
    if page.locator(".product-update-close").count():
        page.locator(".product-update-close").click(force=True)
    clarification.get_by_role("button", name="Lanjutkan", exact=True).click()
    page.locator(".work-plan-rail").wait_for(timeout=60000)
    assert page.locator(".workflow-card").count() == 0
    visible_steps = page.locator(".work-plan-rail li")
    assert 1 <= visible_steps.count() <= 7
    visible_titles = visible_steps.locator("b").all_inner_texts()
    assert len(set(title.lower() for title in visible_titles)) == len(visible_titles)
    assert page.locator(".message-brand-mark").count() == 0
    assert page.locator(".message > span").count() == 0
    assert "Laprak Jaringan Komputer - Static Routing" in page.locator(".header-title b").inner_text()
    if SCREENSHOT_PATH:
        os.makedirs(os.path.dirname(os.path.abspath(SCREENSHOT_PATH)), exist_ok=True)
        page.wait_for_timeout(450)
        page.screenshot(path=SCREENSHOT_PATH, full_page=False)

    message_font = page.locator(".message.user p").evaluate(
        "(node) => getComputedStyle(node).fontSize"
    )
    assert 15 <= float(message_font.replace("px", "")) <= 16, message_font
    user_width = page.locator(".message.user > div").evaluate(
        "(node) => ({ width: node.getBoundingClientRect().width, parent: node.parentElement.getBoundingClientRect().width })"
    )
    assert user_width["width"] <= user_width["parent"] * 0.71

    page.reload(wait_until="networkidle")
    page.locator(".work-plan-rail").wait_for(timeout=30000)
    assert page.locator(".first-use-guidance").count() == 0
    assert page.locator(".workspace-tutorial").count() == 0
    assert page.get_by_role("button", name="Buka tutorial").is_visible()
    page.get_by_role("button", name="Settings", exact=True).click()
    page.get_by_role("button", name="Personalisasi", exact=True).click()
    page.get_by_label("Nama panggilan", exact=True).fill("Sep")
    page.locator(".nickname-settings-control").get_by_role(
        "button", name="Simpan", exact=True
    ).click()
    page.get_by_text("Nama panggilan disimpan.").wait_for()
    page.get_by_role("button", name="Tutup settings").click()

    page.evaluate(
        """() => {
          const prefs = JSON.parse(localStorage.getItem('laprakin-preferences') || '{}');
          localStorage.setItem('laprakin-preferences', JSON.stringify({ ...prefs, theme: 'dark' }));
        }"""
    )
    page.reload(wait_until="networkidle")
    page.locator(".workspace.theme-dark").wait_for()
    assert page.locator(".work-plan-rail").is_visible()

    page.evaluate(
        """() => {
          const target = document.querySelector('.chat-surface');
          const transfer = new DataTransfer();
          transfer.items.add(new File(['bukti tambahan'], 'bukti.txt', { type: 'text/plain' }));
          target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
        }"""
    )
    page.locator(".pending-file-chip").wait_for()
    page.locator(".toast").wait_for()
    dark_toast_colors = page.locator(".toast").evaluate(
        "(node) => ({ background: getComputedStyle(node).backgroundColor, color: getComputedStyle(node).color })"
    )
    assert dark_toast_colors["background"] == "rgb(244, 245, 241)", dark_toast_colors
    assert dark_toast_colors["color"] == "rgb(20, 22, 20)", dark_toast_colors
    page.locator(".pending-file-chip button").click()

    page.get_by_role("button", name="Settings", exact=True).click()
    page.get_by_role("button", name="Keyboard", exact=True).click()
    page.get_by_label("Enter untuk kirim", exact=True).set_checked(True)
    page.get_by_role("button", name="Tutup settings").click()

    page.set_viewport_size({"width": 390, "height": 844})
    page.locator(".composer").wait_for()
    overflow = page.evaluate(
        "() => document.documentElement.scrollWidth - document.documentElement.clientWidth"
    )
    assert overflow <= 1, overflow
    assert page.locator(".composer").is_visible()

    page.get_by_role("button", name="Chat baru").click()
    assert page.locator(".chat-welcome h1").filter(has_text="Sep?").is_visible()
    assert page.get_by_text(
        "Ceritakan tugas dan topiknya. Bahan praktik bisa ditambahkan sekarang atau nanti."
    ).count() == 0
    page.locator(".composer textarea").fill("Buatkan laprak")
    page.locator(".composer textarea").press("Shift+Enter")
    assert page.locator(".composer textarea").input_value() == "Buatkan laprak\n"
    page.locator(".composer textarea").dispatch_event(
        "keydown", {"key": "Enter", "isComposing": True}
    )
    assert page.locator(".clarification-inline").count() == 0
    page.locator(".composer textarea").press("Enter")
    page.locator(".clarification-inline").wait_for()
    assert page.locator(".clarification-inline").count() == 1
    assert page.locator(".clarification-fields label").count() == 2
    assert page.locator(".clarification-fields label").nth(1).get_by_text("Opsional").is_visible()
    page.reload(wait_until="networkidle")
    page.locator(".clarification-inline").wait_for()
    assert page.locator(".clarification-inline").count() == 1
    assert not browser_errors, browser_errors

    profile = context.request.get(f"{BASE_URL}/api/auth/me")
    assert profile.ok, profile.text()
    user = profile.json()["user"]
    assert user["fullName"] == "Asep Saputra"
    assert user["nickname"] == "Sep"
    assert user["nim"] == "2300001"
    assert user["className"] == "TI-2A"
    assert user["departmentKey"] == "jkb"
    assert user["studyProgramKey"] == "ti"

    print(
        "UI workflow passed: dropped files stay pending until Enter, the custom work "
        "rail is unboxed and progressive, clarification persists, and toast contrast "
        "adapts on desktop, dark mode, and mobile."
    )
    browser.close()
