"""Сквозной автотест стенда MY OS v3 в браузере (Chromium, размер экрана iPad)."""
import hashlib, io, json, os, shutil, sys, zipfile
from playwright.sync_api import sync_playwright, expect

BASE = "http://localhost:8787"
D = "/tmp/e2e"
results = []


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    print(("PASS " if cond else "FAIL ") + name + (" — " + detail if detail else ""))


with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": 1024, "height": 1366}, timezone_id="Asia/Yekaterinburg", locale="ru-RU", accept_downloads=True)
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(BASE)

    # Шаг 1: часовой пояс не выбран, iPad только предлагает
    expect(page.locator("#s-tz")).to_contain_text("не выбран", timeout=10000)
    check("часовой пояс не ставится сам", "Asia/Yekaterinburg" in page.locator("#s-tz").inner_text(), page.locator("#s-tz").inner_text())
    page.select_option("#tz-select", "Europe/Samara")
    page.click("#tz button")
    expect(page.locator("#s-tz")).to_contain_text("выбран Europe/Samara")
    check("часовой пояс сохраняется по выбору", True)
    # неверный пояс отклоняется сервером
    r = page.request.post(BASE + "/api/settings", data=json.dumps({"timezone": "Mars/Base"}))
    check("неверный часовой пояс отклонён", r.status == 400 and "Неизвестный" in r.json()["error"])

    # Шаг 2: связь и база
    expect(page.locator("#s-check")).to_contain_text("база", timeout=10000)
    check("связь и база", "работает" in page.locator("#s-check").inner_text(), page.locator("#s-check").inner_text())

    # Шаг 3: фото и PDF
    page.set_input_files("#file-input", [f"{D}/Фото_1.jpg", f"{D}/Фото_2.jpg", f"{D}/Договор.pdf"])
    expect(page.locator("#s-files")).to_contain_text("3 из 3", timeout=20000)
    check("фото и PDF совпали байт в байт", "фото и PDF" in page.locator("#s-files").inner_text(), page.locator("#s-files").inner_text())

    # Шаг 7: тестовые данные → копия
    page.click("button:has-text(\"Создать тестовые данные\")")
    expect(page.locator("#backup-out")).to_contain_text("Созданы тестовые данные", timeout=10000)
    page.click("button:has-text(\"Сделать копию\")")
    expect(page.locator("#backup-out")).to_contain_text("Копия готова", timeout=20000)
    with page.expect_download() as dl:
        page.click("#save-backup")
    zpath = f"{D}/копия.zip"
    dl.value.save_as(zpath)
    check("копия сохраняется файлом", os.path.getsize(zpath) > 1_000_000, dl.value.suggested_filename)

    # Независимая проверка архива стандартной библиотекой Python
    z = zipfile.ZipFile(zpath)
    bad = z.testzip()
    man = json.loads(z.read("manifest.json"))
    data = json.loads(z.read("data.json"))
    ok_hash = all(hashlib.sha256(z.read(f["path"])).hexdigest() == f["sha256"] for f in man["files"])
    check("архив читается стандартным ZIP (CRC целы)", bad is None)
    check("отпечатки файлов в архиве верны", ok_hash, f"файлов {len(man['files'])}")
    check("data.json совпадает с отпечатком", hashlib.sha256(z.read("data.json")).hexdigest() == man["dataSha256"])
    originals = {n: hashlib.sha256(open(f"{D}/{n}", "rb").read()).hexdigest() for n in ["Фото_1.jpg", "Фото_2.jpg", "Договор.pdf"]}
    in_zip = {f["name"]: f["sha256"] for f in man["files"]}
    check("исходные фото и PDF лежат в копии без изменений", all(in_zip.get(n) == h for n, h in originals.items()))
    check("в копии есть версии, связи и вложения", man["counts"]["versions"] == 5 and man["counts"]["links"] == 4 and man["counts"]["attachments"] == 5, json.dumps(man["counts"], ensure_ascii=False))
    check("в копии сохранена ссылка на опубликованную версию", "https://t.me/example/123" in json.dumps(data, ensure_ascii=False))

    # Стирание (двойное нажатие)
    page.click("#wipe-btn")
    expect(page.locator("#wipe-btn")).to_contain_text("Точно стереть")
    page.click("#wipe-btn")
    expect(page.locator("#backup-out")).to_contain_text("Стёрто", timeout=10000)
    v = page.request.get(BASE + "/api/backup/verify").json()
    check("после стирания пусто", sum(v["counts"].values()) == 0 and len(v["files"]) == 0, json.dumps(v["counts"]))
    expect(page.locator("#s-tz")).to_contain_text("не выбран")

    # Восстановление из файла
    page.set_input_files("#restore-input", zpath)
    expect(page.locator("#s-backup")).to_contain_text("восстановлено и сверено", timeout=30000)
    check("восстановление со сверкой", True, page.locator("#s-backup").inner_text())
    expect(page.locator("#s-tz")).to_contain_text("Europe/Samara")
    check("часовой пояс вернулся из копии", True)
    after = page.request.get(BASE + "/api/backup/data").json()
    canon = lambda t: json.dumps({k: sorted(json.dumps(r, sort_keys=True) for r in v) for k, v in t.items()}, sort_keys=True)
    check("строки после восстановления поле в поле как в копии (проверка Python)", canon(after["tables"]) == canon(data["tables"]))
    for f in man["files"]:
        got = page.request.get(BASE + "/api/files/" + f["id"]).body()
        if hashlib.sha256(got).hexdigest() != f["sha256"]:
            check("файл после восстановления " + f["name"], False)
            break
    else:
        check("все файлы после восстановления скачиваются байт в байт", True)

    # Копия, пересжатая другой программой (deflate), тоже восстанавливается
    rez = f"{D}/пересжатая.zip"
    with zipfile.ZipFile(rez, "w", zipfile.ZIP_DEFLATED) as out:
        for n in z.namelist():
            out.writestr("Копия/" + n, z.read(n))
    page.set_input_files("#restore-input", rez)
    expect(page.locator("#s-backup")).to_contain_text("восстановлено и сверено", timeout=30000)
    check("пересжатая копия (в папке, deflate) восстанавливается", True)

    # Повреждённая копия отклоняется до стирания данных
    raw = bytearray(open(zpath, "rb").read())
    raw[len(raw) // 2] ^= 0xFF
    open(f"{D}/битая.zip", "wb").write(raw)
    before = page.request.get(BASE + "/api/backup/verify").json()["counts"]
    page.set_input_files("#restore-input", f"{D}/битая.zip")
    expect(page.locator("#s-backup")).to_contain_text("повреждена", timeout=15000)
    still = page.request.get(BASE + "/api/backup/verify").json()["counts"]
    check("битая копия отклонена, данные не тронуты", before == still, page.locator("#s-backup").inner_text())

    # Счётчики с источниками
    page.click("#limits >> text=Обновить")
    expect(page.locator("#counters")).to_contain_text("источник", timeout=10000)
    txt = page.locator("#counters").inner_text()
    check("у счётчиков указан источник", txt.count("источник:") == 10 and "оценка MY OS" in txt and "Cloudflare" in txt and "подсчёт стенда" in txt)
    check("сброс лимитов показан по местному времени", "по твоему времени" in txt)

    # Telegram: в Chromium «Поделиться» с файлами нет — проверяем честное сообщение
    page.click("button:has-text(\"Текст + 3 картинки\")")
    page.wait_for_timeout(1500)
    check("без поддержки «Поделиться» — понятная ошибка", page.locator("#s-share").inner_text() != "не проверено", page.locator("#s-share").inner_text())

    # Переход из уведомления
    page.goto(BASE + "/#push")
    page.wait_for_timeout(800)
    check("ссылка из уведомления открывает раздел", "переход" not in errors and "Переход из уведомления" in page.locator("#report").inner_text())

    # Латиница в интерфейсе (кроме названий моделей, Face ID, PDF, VPN, Telegram, Cloudflare, ZIP)
    body = page.evaluate("() => { const c = document.body.cloneNode(true); c.querySelectorAll('select').forEach(e => e.remove()); document.documentElement.appendChild(c); const t = c.innerText; c.remove(); return t; }")
    import re
    allowed = {"MY", "OS", "VPN", "PDF", "Face", "ID", "Telegram", "Cloudflare", "UTC", "Qwen3", "B", "Gemma", "gpt", "oss", "Safari", "SHA", "iPad", "Europe", "Samara", "GMT", "ZIP", "Yekaterinburg", "Asia", "Claude", "DFW", "US", "jpg", "pdf", "zip"}
    words = set(re.findall(r"[A-Za-z]+", body)) - allowed
    check("интерфейс на русском", not words, ", ".join(sorted(words)))
    page.screenshot(path=f"{D}/стенд.png", full_page=True)
    check("нет ошибок JavaScript", not errors, "; ".join(errors))
    b.close()

ok = sum(1 for r in results if r[1])
print(f"\nИтог: {ok} из {len(results)}")
json.dump(results, open(f"{D}/results.json", "w"), ensure_ascii=False)
sys.exit(0 if ok == len(results) else 1)
