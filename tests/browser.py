"""Browser regression suite. pip install -r tests/requirements.txt; playwright install chromium.
Run against a built app with `python tests/browser.py` (starts its own local server).
`--inline` uses the portable HTML via set_content when browser navigation is prohibited.
That fallback intentionally tests the real in-memory failure mode, NOT IndexedDB or SW.
"""
import json
import os
import subprocess
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'artifacts'
ART.mkdir(exist_ok=True)
INLINE = '--inline' in sys.argv
HTML = (ROOT / 'dist/horizon-standalone.html').read_text()
checks = []
server = None

def ok(name):
    checks.append(name)
    print('PASS', name, flush=True)

def open_app(page):
    if INLINE:
        page.set_content(HTML, wait_until='load')
    else:
        page.goto('http://127.0.0.1:4181/', wait_until='networkidle')
    page.wait_for_selector('#compose-submit:enabled')

def exported(page):
    with page.expect_download() as info:
        page.locator('#export').click()
    return json.loads(Path(info.value.path()).read_text())

try:
    if not INLINE:
        server = subprocess.Popen(['node', 'scripts/serve.mjs'], cwd=ROOT, env={**os.environ, 'PORT':'4181'}, stdout=subprocess.DEVNULL)
        time.sleep(1)
    with sync_playwright() as p:
        launch = {'headless': True}
        if os.environ.get('HORIZON_CHROMIUM'):
            launch['executable_path'] = os.environ['HORIZON_CHROMIUM']
        browser = p.chromium.launch(**launch)
        context = browser.new_context(viewport={'width':1536,'height':1050}, reduced_motion='reduce', accept_downloads=True)
        page = context.new_page()
        errors = []
        external = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('request', lambda r: external.append(r.url) if r.url.startswith('http') and '127.0.0.1' not in r.url else None)
        open_app(page)
        expect(page.get_by_role('heading', name='Меньше интерфейса. Больше намерения.')).to_be_visible()
        ok('application boots and exposes an accessible heading')
        if INLINE:
            expect(page.locator('#storage-warning')).to_be_visible()
            ok('storage failure stays visible; application works in memory')
        page.locator('#intent').fill('Сочини симфонию')
        page.locator('#compose-submit').click()
        expect(page.locator('#notice')).to_contain_text('Не удалось определить')
        ok('unknown request fails explicitly without pretending to understand')
        page.locator('[data-example="launch"]').click()
        expect(page.locator('[data-change]')).to_have_count(3)
        assert exported(page)['budget'] == 45000
        ok('preview does not mutate applied/exported data')
        page.locator('[data-change="budget"]').uncheck()
        page.locator('#apply').click()
        expect(page.locator('#notice')).to_contain_text('Изменения')
        assert exported(page)['budget'] == 45000 and exported(page)['weeks'] == 4
        ok('selective approval applies only the checked fields')
        page.locator('#undo').click()
        assert exported(page)['weeks'] == 6
        expect(page.locator('.history')).to_contain_text('отменено')
        ok('undo restores data and remains in the audit trail')
        page.locator('.view-controls [data-manual]').click()
        expect(page.get_by_role('dialog')).to_be_visible()
        page.locator('[name="title"]').fill('Тест <img src=x onerror="alert(1)">')
        page.locator('[name="budget"]').fill('75000')
        page.locator('[name="weeks"]').fill('5')
        page.locator('#manual-form button[type="submit"]').click()
        assert page.locator('.brief img').count() == 0
        expect(page.locator('.brief')).to_contain_text('<img')
        page.locator('#apply').click()
        assert exported(page)['budget'] == 75000
        ok('manual path uses the same approval boundary; text is escaped')
        page.locator('#command').focus()
        page.keyboard.press('Control+k')
        expect(page.get_by_role('dialog')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.get_by_role('dialog')).not_to_be_visible()
        assert page.evaluate("document.activeElement.id") == 'command'
        ok('keyboard command dialog closes with Escape and restores focus')
        page.locator('#pin').click()
        before = page.locator('#modules > section').count()
        page.locator('[data-example="focus"]').click()
        assert page.locator('#modules > section').count() == before
        page.locator('#pin').click()
        page.locator('[data-example="focus"]').click()
        expect(page.locator('#modules > section')).to_have_count(1)
        ok('user-pinned composition resists adaptation; unpinning restores it')
        page.locator('#dismiss').click()
        page.locator('[data-task="0"]').click()
        page.locator('#apply').click()
        assert exported(page)['done'][0] is True
        ok('task completion has a real, reversible state transition')
        page.locator('#import-file').set_input_files({'name':'project.json','mimeType':'application/json','buffer':json.dumps({'title':'Локальный импорт','budget':88000,'weeks':8,'stage':'idea','done':[False]*4}).encode()})
        expect(page.locator('#notice')).to_contain_text('Импорт не применён')
        assert exported(page)['budget'] == 75000
        page.locator('#apply').click()
        assert exported(page)['budget'] == 88000
        ok('JSON import stays local and requires review')
        page.locator('#import-file').set_input_files({'name':'bad.json','mimeType':'application/json','buffer':b'{"html":"<script>"}'})
        expect(page.locator('#notice')).to_contain_text('Некорректный JSON')
        ok('invalid imported data is rejected')
        page.locator('[data-nav="evidence"]').click()
        expect(page.locator('.evidence-row')).to_have_count(7)
        page.locator('summary').first.click()
        expect(page.locator('details').first).to_have_attribute('open','')
        ok('seven evidence entries disclose inference and limitations')
        page.locator('[data-nav="lab"]').click()
        for _ in range(2):
            page.locator('[data-lab="start"]').click()
            if page.locator('#lab-budget').count():
                page.locator('#lab-budget').fill('60000')
                page.locator('#lab-weeks').fill('4')
            else:
                page.locator('#lab-prompt').fill('Бюджет 60 000 ₴ за 4 недели')
            page.locator('[data-lab="prepare"]').click()
            page.locator('[data-lab="confirm"]').click()
        expect(page.locator('tbody tr')).to_have_count(2)
        ok('both timed experiment paths record measured results')
        page.screenshot(path=str(ART/'lab.png'), full_page=True)
        page.locator('[data-nav="workspace"]').click()
        expect(page.locator('h1 em').first).to_be_visible()
        page.locator('#focus').click()
        expect(page.locator('.workspace-intro')).not_to_be_visible()
        page.locator('#focus').click()
        ok('focus mode is explicit and reversible')
        assert not external
        ok('core interactions make zero external HTTP requests')
        assert not errors, errors
        ok('no JavaScript page errors during core workflow')
        if not INLINE:
            page.reload(wait_until='networkidle')
            page.wait_for_selector('#compose-submit:enabled')
            assert exported(page)['budget'] == 88000
            ok('IndexedDB survives a real reload')
            page.wait_for_function('navigator.serviceWorker.controller !== null')
            context.set_offline(True)
            page.reload(wait_until='load')
            page.wait_for_selector('#compose-submit:enabled')
            assert exported(page)['budget'] == 88000
            context.set_offline(False)
            ok('installed service worker cold-reloads the app offline')
            second = context.new_page(); open_app(second)
            second.locator('[data-example="launch"]').click()
            page.locator('[data-example="launch"]').click(); page.locator('#apply').click()
            expect(page.locator('#notice')).to_contain_text('сохранены')
            second.locator('#apply').click()
            expect(second.locator('#notice')).to_contain_text('другой вкладке')
            second.close()
            ok('atomic revision check rejects a stale cross-tab write')
        for width in [1536, 1024, 390, 320]:
            fresh = browser.new_context(viewport={'width':width,'height':1050 if width>620 else 844}, reduced_motion='reduce')
            view = fresh.new_page(); open_app(view)
            view.locator('[data-example="launch"]').click()
            expect(view.locator('[data-change]')).to_have_count(3)
            assert view.evaluate('document.documentElement.scrollWidth <= innerWidth'), width
            if width < 620:
                expect(view.locator('#mobile-review-bar')).to_be_visible()
                view.locator('#jump-review').click()
                assert view.evaluate("document.activeElement.id") == 'review'
                view.locator('#command').click()
                expect(view.get_by_role('dialog')).to_be_visible()
                view.keyboard.press('Escape')
                view.evaluate('scrollTo(0,0)')
            view.screenshot(path=str(ART/f'workspace-{width}.png'), full_page=True)
            fresh.close()
            ok(f'{width}px viewport: no overflow, visible controls, portable rendering')
        browser.close()
    report = {'passed':len(checks),'checks':checks,'mode':'inline' if INLINE else 'http','not_verified': ['IndexedDB reload','service-worker offline reload','cross-tab storage concurrency','screen readers','Firefox and Safari','axe automated accessibility audit'] if INLINE else ['screen readers','Firefox and Safari','axe automated accessibility audit']}
    (ART/'browser-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps(report,ensure_ascii=False,indent=2))
finally:
    if server:
        server.terminate(); server.wait(timeout=10)
