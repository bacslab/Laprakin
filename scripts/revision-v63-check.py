import time

from playwright.sync_api import sync_playwright


BASE_URL = "http://localhost:5173"
stamp = int(time.time() * 1000)
device = f"revision-v63-{stamp}"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(
        viewport={"width": 1440, "height": 900},
        extra_http_headers={"x-laprakin-device": device},
    )
    registration = context.request.post(
        f"{BASE_URL}/api/auth/register",
        data={"email": f"{device}@example.test", "password": "KataSandi-Uji-2026"},
    )
    assert registration.status == 201, registration.text()
    verification = context.request.post(
        f"{BASE_URL}/api/auth/verify",
        data={"token": registration.json()["developmentVerificationToken"]},
    )
    assert verification.ok, verification.text()
    csrf = verification.json()["csrfToken"]
    onboarding = context.request.post(
        f"{BASE_URL}/api/profile/onboarding",
        headers={"x-laprakin-csrf": csrf},
        data={"dismissed": True},
    )
    assert onboarding.ok, onboarding.text()
    welcome_credit = context.request.post(
        f"{BASE_URL}/api/wallet/claim-welcome",
        headers={"x-laprakin-csrf": csrf},
    )
    assert welcome_credit.ok, welcome_credit.text()
    processing_access = context.request.get(f"{BASE_URL}/api/chat/processing-access")
    assert processing_access.ok and processing_access.json()["available"], processing_access.text()

    page = context.new_page()
    chat_requests = []
    chat_responses = []
    page.on("request", lambda request: chat_requests.append(request.url) if "/api/chat" in request.url else None)
    page.on("response", lambda response: chat_responses.append({"url": response.url, "status": response.status}) if "/api/chat" in response.url else None)
    page.add_init_script(
        """
        localStorage.setItem('laprakin-preferences', JSON.stringify({
          theme: 'dark', accent: 'lime', productUpdates: false,
          allowExternalAi: true, reducedMotion: false
        }));
        """
    )
    page.goto(f"{BASE_URL}/app", wait_until="networkidle")
    composer = page.locator(".composer textarea")
    composer.wait_for()

    composer.fill("\n".join(f"Baris {index}" for index in range(1, 12)))
    tall_height = composer.evaluate("node => node.getBoundingClientRect().height")
    composer.fill("Baris 1\nBaris 2\nBaris 3")
    three_line_height = composer.evaluate("node => node.getBoundingClientRect().height")
    composer.fill("Baris 1")
    initial_height = composer.evaluate("node => node.getBoundingClientRect().height")
    assert tall_height > three_line_height > initial_height, {
        "tall": tall_height,
        "three": three_line_height,
        "initial": initial_height,
    }

    composer.fill("Tolong buatkan laporan dari materi ini.")
    page.wait_for_timeout(150)
    assert page.get_by_role("button", name="Kirim pesan").is_enabled()
    page.evaluate("window.__composerKeys = []; document.querySelector('.composer textarea').addEventListener('keydown', event => window.__composerKeys.push(event.key))")
    composer.press("Enter")
    page.wait_for_timeout(350)
    assert "Enter" in page.evaluate("window.__composerKeys")
    try:
        page.locator(".config-required-note").wait_for(timeout=12000)
    except Exception as error:
        raise AssertionError({
            "body": page.locator("body").inner_text()[:2400],
            "composer": composer.input_value(),
            "requests": chat_requests,
            "responses": chat_responses,
        }) from error
    assert page.get_by_placeholder("Contoh: Jaringan Komputer").is_visible()
    assert page.get_by_placeholder("Contoh: Routing Protocol").is_visible()
    assert page.locator(".message-turn-assistant").count() == 0

    page.get_by_placeholder("Contoh: Jaringan Komputer").fill("Jaringan Komputer")
    page.get_by_placeholder("Contoh: Routing Protocol").fill("Routing Protocol")
    assert page.get_by_role("button", name="Simpan & mulai").is_enabled()

    page.get_by_role("button", name="Tutup konfigurasi").click()
    page.get_by_role("button", name="Feedback", exact=True).click()
    modal = page.locator(".feedback-modal-v2")
    modal.wait_for()
    modal_box = modal.evaluate("node => node.getBoundingClientRect()")
    assert modal_box["width"] <= 852, modal_box
    assert page.locator(".feedback-rating button.active").count() == 0
    assert page.get_by_role("button", name="Kirim masukan").is_disabled()
    assert page.get_by_role("button", name="Bagikan jawaban").count() == 0

    page.get_by_role("button", name="Tutup", exact=True).click()
    browser.close()

print("revision v63 browser checks passed")
