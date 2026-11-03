"""Upgrade a real cached v0.5 portfolio and repair the user's mixed progression."""
import functools
import http.server
import io
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import threading
import zipfile
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
with tempfile.TemporaryDirectory(prefix='gcs-upgrade-') as folder:
    site = Path(folder)/'codex'
    legacy = subprocess.check_output(['git','show','62ac9ac:release/Guitar-Composer-Studio-Web.zip'],cwd=ROOT)
    with zipfile.ZipFile(io.BytesIO(legacy)) as z: z.extractall(site)
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietServer,directory=folder))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    try:
        with sync_playwright() as p:
            browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
            context=browser.new_context(viewport={'width':1440,'height':1000})
            page=context.new_page();page.set_default_timeout(20000)
            page.goto(f'http://127.0.0.1:{server.server_port}/codex/')
            expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
            page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
            page.reload()
            page.get_by_label('Nume proiect',exact=True).fill('Proiect păstrat la actualizare')
            page.get_by_label('Tonalitate',exact=True).select_option('D')
            page.get_by_label('Mod tonalitate',exact=True).select_option('minor')
            page.get_by_label('Fundamentală în progresie',exact=True).select_option('G')
            page.get_by_label('Tip acord în progresie',exact=True).select_option('m11')
            for card,symbol in zip(page.locator('.chord-card').all(),['Gm11','Am7','Dm7','G7']): expect(card).to_contain_text(symbol)
            expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
            page.evaluate('window.__oldController=navigator.serviceWorker.controller')
            shutil.rmtree(site);shutil.copytree(ROOT/'dist',site)
            page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)')
            page.wait_for_function('window.__oldController !== navigator.serviceWorker.controller')
            page.reload()
            expect(page.locator('.app-version')).to_have_text('v0.6.1')
            expect(page.get_by_label('Nume proiect',exact=True)).to_have_value('Proiect păstrat la actualizare')
            assert page.evaluate('navigator.serviceWorker.getRegistration().then(r=>!r.waiting)')
            # Repair an already saved mixed progression without changing its chosen key.
            page.get_by_role('button',name='Regenerează progresia',exact=True).click()
            for card,symbol in zip(page.locator('.chord-card').all(),['Dm7','Bbmaj7','Gm7','Am7']): expect(card).to_contain_text(symbol)
            page.get_by_label('Tonalitate',exact=True).select_option('E')
            for card,symbol in zip(page.locator('.chord-card').all(),['Em7','Cmaj7','Am7','Bm7']): expect(card).to_contain_text(symbol)
            page.get_by_label('Mod tonalitate',exact=True).select_option('major')
            for card,symbol in zip(page.locator('.chord-card').all(),['Emaj7','C#m7','F#m7','B7']): expect(card).to_contain_text(symbol)
            expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
            # A later update offers a safe reload instead of interrupting playback.
            sw = site/'sw.js'
            sw.write_text(sw.read_text()+'\n// Browser regression update probe\n')
            page.evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)')
            update = page.get_by_role('button',name='Încarcă actualizarea',exact=True)
            expect(update).to_be_visible()
            page.get_by_role('button',name='Redă progresia',exact=True).click()
            expect(update).to_be_disabled()
            page.get_by_role('button',name='Oprește progresia',exact=True).click()
            expect(update).to_be_enabled()
            update.click()
            expect(page.locator('.app-version')).to_have_text('v0.6.1')
            expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
            context.set_offline(True);page.reload()
            expect(page.locator('.app-version')).to_have_text('v0.6.1')
            expect(page.locator('.chord-card')).to_have_count(4)
            expect(page.locator('.chord-card').nth(3)).to_contain_text('B7')
            print(json.dumps({'result':'passed','checks':['real cached v0.5 upgrade without clearing browser data','no stranded waiting worker','saved project preserved','same-key regeneration repairs screenshot progression','all four chords regenerate on root and mode change','future update reload waits for playback and saved state','offline upgraded reload']}))
            browser.close()
    finally:
        server.shutdown();server.server_close()
