import json
import os
import time

from playwright.sync_api import sync_playwright


BASE_URL = os.environ.get("VISUAL_BASE_URL", "http://localhost:5173")
API_URL = os.environ.get("VISUAL_API_URL", BASE_URL)
email = f"visual-{int(time.time() * 1000)}@example.test"
password = "KataSandi-Visual-2026"
device = f"visual-{int(time.time() * 1000)}"
output_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "output", "workflow-ui.png"))
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1)
    request = context.request
    common_headers = {"x-laprakin-device": device}

    health_ready = False
    for _ in range(100):
        try:
            health = request.get(f"{API_URL}/api/health", headers=common_headers)
            if health.ok:
                health_ready = True
                break
        except Exception:
            pass
        page_delay = 0.1
        time.sleep(page_delay)
    assert health_ready, "API backend tidak siap setelah 10 detik."

    registration = request.post(
        f"{API_URL}/api/auth/register",
        headers=common_headers,
        data={"email": email, "password": password},
    )
    assert registration.status == 201, f"{registration.status}: {registration.text()}"
    verification_token = registration.json()["developmentVerificationToken"]
    verification = request.post(
        f"{API_URL}/api/auth/verify",
        headers=common_headers,
        data={"token": verification_token},
    )
    assert verification.ok, verification.text()
    csrf = verification.json()["csrfToken"]
    profile = request.put(
        f"{API_URL}/api/profile",
        headers={**common_headers, "x-laprakin-csrf": csrf},
        data={
            "fullName": "Asep Visual",
            "nim": "2400000001",
            "className": "TI-2A",
            "departmentKey": "jkb",
            "studyProgramKey": "ti",
        },
    )
    assert profile.ok, profile.text()

    page = context.new_page()
    console_errors = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.add_init_script(
        f"""
        sessionStorage.setItem('laprakin-csrf-token', {json.dumps(csrf)});
        localStorage.setItem('laprakin-preferences', JSON.stringify({{
          theme: 'dark', accent: 'gray', allowExternalAi: true, productUpdates: false,
          tone: 'semi-formal', perspective: 'saya', profile: 'langkah'
        }}));
        """
    )
    page.goto(f"{BASE_URL}/app", wait_until="networkidle")
    composer = page.locator(".composer textarea")
    composer.wait_for(state="visible")
    composer.fill("Asep")
    composer.press("Enter")
    try:
        page.get_by_text("Aku belum punya konteks yang cukup", exact=False).wait_for(timeout=15000)
    except Exception as error:
        debug_path = output_path.replace("workflow-ui.png", "workflow-ui-debug.png")
        page.screenshot(path=debug_path, full_page=True)
        body_text = page.locator("body").inner_text()[:3000]
        raise AssertionError(f"Respons klarifikasi tidak muncul. URL={page.url}\nConsole={console_errors}\nBody={body_text}\nScreenshot={debug_path}") from error
    panel = page.locator(".workflow-panel")
    panel.wait_for(state="visible")
    page.locator(".chat-thread").evaluate("element => { element.scrollTop = element.scrollHeight; }")
    page.wait_for_timeout(350)

    assert panel.locator(".chat-workflow-steps li").count() == 3
    assert panel.get_by_text("Pahami tugas", exact=True).is_visible()
    assert page.get_by_role("button", name="Buat dokumen kerja").count() == 0
    assert page.locator(".create-document-row").count() == 0

    metrics = page.evaluate(
        """
        () => {
          const composer = document.querySelector('.composer');
          const workspace = document.querySelector('.workspace');
          const panel = document.querySelector('.workflow-panel');
          return {
            font: getComputedStyle(workspace).fontFamily,
            composerShadow: getComputedStyle(composer).boxShadow,
            bodyOverflow: document.documentElement.scrollWidth - window.innerWidth,
            panelRight: panel.getBoundingClientRect().right,
            viewportWidth: window.innerWidth,
          };
        }
        """
    )
    assert "Plus Jakarta Sans" in metrics["font"]
    assert metrics["composerShadow"] == "none"
    assert metrics["bodyOverflow"] <= 1
    assert metrics["panelRight"] <= metrics["viewportWidth"]
    assert not console_errors, console_errors

    page.screenshot(path=output_path, full_page=True)
    print(json.dumps({"screenshot": output_path, "metrics": metrics}, ensure_ascii=False))
    browser.close()
