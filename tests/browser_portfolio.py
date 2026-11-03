"""Portfolio: serve under /codex/ like Pages and prove no backend/model/mic is needed."""
import functools
import http.server
import io
import json
import os
from pathlib import Path
import shutil
import tempfile
import threading
import zipfile
from playwright.sync_api import sync_playwright, expect

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts';OUT.mkdir(exist_ok=True)
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self,*args):pass
with tempfile.TemporaryDirectory(prefix='gcs-pages-test-') as folder:
    shutil.copytree(ROOT/'dist',Path(folder)/'codex')
    server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietServer,directory=folder))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    url=f'http://127.0.0.1:{server.server_port}/codex/'
    with sync_playwright() as p:
        browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
        context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
        context.add_init_script('''window.__micCalls=0;if(navigator.mediaDevices)navigator.mediaDevices.getUserMedia=()=>{window.__micCalls++;return Promise.reject(new Error('Demo must not request microphone'));};''')
        outside=[]
        def boundary(route):
            if route.request.url.startswith(f'http://127.0.0.1:{server.server_port}/'):route.continue_()
            else:outside.append(route.request.url);route.abort()
        context.route('**/*',boundary)
        page=context.new_page();page.set_default_timeout(15000);errors=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.goto(url)
        expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
        page.get_by_role('button',name='Demo complet',exact=True).click()
        expect(page.get_by_label('Nume proiect',exact=True)).to_have_value('Nocturne · demo de portofoliu')
        expect(page.locator('.chord-card')).to_have_count(4)
        page.get_by_role('button',name='Redă progresia',exact=True).click()
        expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
        page.get_by_role('button',name='Oprește progresia',exact=True).click()
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
        expect(page.locator('.note-start')).not_to_have_count(0)
        page.get_by_role('button',name='Backing & Export',exact=True).click()
        expect(page.get_by_label('Activează acompaniamentul',exact=True)).to_be_checked()
        expect(page.get_by_role('button',name='Mute Melodie',exact=True)).to_have_attribute('aria-pressed','false')
        page.get_by_role('button',name='Audio Studio',exact=True).click()
        expect(page.locator('.audio-clip')).to_have_count(1)
        page.get_by_role('button',name='Asistent',exact=True).click()
        expect(page.get_by_role('heading',name='Asistent de compoziție',exact=True,level=2)).to_be_visible()
        expect(page.get_by_text('Reguli muzicale · local',exact=True)).to_be_visible()
        expect(page.get_by_role('button',name='Verifică și listează modelele',exact=True)).to_have_count(0)
        page.get_by_role('button',name='Construiește o cadență',exact=True).click()
        expect(page.locator('.proposal-preview')).to_contain_text('Dm7 → G7 → Cmaj7')
        page.get_by_role('button',name='Aplică recomandarea',exact=True).click()
        page.get_by_role('button',name='Harmony Studio',exact=True).click()
        expect(page.locator('.chord-card')).to_have_count(3)
        with page.expect_download() as download:
            page.get_by_role('link',name='Descarcă ZIP',exact=True).click()
        path=OUT/'downloaded-portfolio.zip';download.value.save_as(path)
        with zipfile.ZipFile(path) as z:
            assert sorted(z.namelist())==['README.txt','index.html']
            assert b'data-portable' in z.read('index.html')
            assert b'/src/main.tsx' not in z.read('index.html')
        manifest=page.evaluate("fetch('./manifest.webmanifest').then(r=>r.json())")
        assert manifest['start_url']=='./' and all(not i['src'].startswith('/') for i in manifest['icons'])
        page.evaluate('navigator.serviceWorker.ready.then(()=>true)')
        expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
        context.set_offline(True)
        page.reload()
        expect(page.get_by_label('Nume proiect',exact=True)).to_have_value('Nocturne · demo de portofoliu')
        page.get_by_role('button',name='Asistent',exact=True).click()
        page.get_by_role('button',name='Propune o melodie',exact=True).click()
        expect(page.locator('.proposal-preview')).to_contain_text('Melodie:')
        page.evaluate('window.scrollTo(0,0)');page.screenshot(path=str(OUT/'portfolio-advisor-desktop.png'),full_page=True)
        for width in [390,768]:
            page.set_viewport_size({'width':width,'height':844})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Portfolio overflow at {width}'
            if width==390:page.screenshot(path=str(OUT/'portfolio-mobile.png'),full_page=True)
        assert page.evaluate('window.__micCalls')==0
        assert not outside,outside
        assert not errors,errors
        print(json.dumps({'result':'passed','checks':['Pages-style subpath','generated complete demo','synth/audio playback','melody/backing/audio views','local advisor preview/apply','standalone ZIP download','relative PWA manifest','offline reload and local recommendations','390/768 responsive'],'external_requests':outside,'microphone_requests':0,'browser_errors':errors}))
        browser.close()
    server.shutdown();server.server_close()
