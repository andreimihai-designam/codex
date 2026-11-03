"""Chord editing and actual per-chord melody guidance, served like GitHub Pages."""
import functools
import http.server
import json
import os
from pathlib import Path
import threading
from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[1]
class QuietServer(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args): pass
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(QuietServer, directory=str(ROOT/'dist')))
threading.Thread(target=server.serve_forever, daemon=True).start()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), args=['--no-sandbox'])
        page = browser.new_page(viewport={'width':1440, 'height':1000})
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.goto(f'http://127.0.0.1:{server.server_port}/')
        expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
        page.get_by_role('button', name='Solo & Melody', exact=True).click()
        def check_tones(tones):
            values = page.locator('.note-lane-label[data-chord-tone="true"]').evaluate_all('(els)=>els.map(e=>Number(e.dataset.midi)%12)')
            assert set(values) == set(tones), values
        for index, symbol, tones in [(1,'Cmaj7',[0,4,7,11]),(2,'Am7',[9,0,4,7]),(3,'Dm7',[2,5,9,0]),(4,'G7',[7,11,2,5])]:
            page.get_by_role('button',name=f'Explorează {symbol}, acordul {index}',exact=True).click()
            check_tones(tones)
            expect(page.locator('.measure-nav')).to_contain_text(f'Măsura {index}')
            expect(page.locator('.focused-chord-notes')).to_contain_text(symbol)
        expect(page.locator('.piano-key, .piano-roll, .black-key')).to_have_count(0)
        expect(page.locator('.note-lane-label')).to_have_count(8)
        page.get_by_role('button',name='Harmony Studio',exact=True).click()
        page.locator('.chord-card').first.click()
        expect(page.get_by_label('Tip acord în progresie',exact=True).locator('option')).to_have_count(28)
        page.get_by_label('Fundamentală în progresie',exact=True).select_option('Db')
        page.get_by_label('Tip acord în progresie',exact=True).select_option('7b9')
        expect(page.locator('.chord-card').first).to_contain_text('Db7b9')
        page.get_by_label('Durată',exact=True).select_option('1')
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
        check_tones([1,5,8,11,2])
        expect(page.locator('.focused-chord-notes')).to_contain_text('Ebb')
        # Quarter-note Db7b9 followed by Am7 in the same measure: C is only in Am7.
        page.get_by_role('button',name='Note pentru Am7 în măsura 1',exact=True).click()
        c_row = page.locator('.roll-row').filter(has=page.locator('.note-lane-label[data-midi="72"]'))
        expect(c_row.locator('.roll-cell').nth(0)).to_have_attribute('data-chord-tone','false')
        expect(c_row.locator('.roll-cell').nth(4)).to_have_attribute('data-chord-tone','true')
        page.get_by_role('button',name='Note pentru Am7 în măsura 1',exact=True).click()
        check_tones([9,0,4,7])
        # A non-chord note is allowed, not disabled by the guide.
        page.get_by_role('button',name='C5, măsura 1, pas 1',exact=True).click()
        expect(page.get_by_role('button',name='C5, măsura 1, pas 1, notă existentă',exact=True)).to_have_attribute('aria-pressed','true')
        expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
        page.reload()
        expect(page.locator('.chord-card').first).to_contain_text('Db7b9')
        page.locator('.chord-card').nth(2).click()
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
        check_tones([2,5,9,0])
        expect(page.get_by_role('button',name='Explorează Dm7, acordul 3',exact=True)).to_have_attribute('aria-pressed','true')
        # Changing either key selector regenerates actual chord cards, not only analysis.
        page.get_by_role('button',name='Harmony Studio',exact=True).click()
        page.get_by_label('Tonalitate',exact=True).select_option('C#')
        for card, symbol in zip(page.locator('.chord-card').all(), ['C#maj7','A#m7','D#m7','G#7']):
            expect(card).to_contain_text(symbol)
        page.get_by_label('Mod tonalitate',exact=True).select_option('minor')
        for card, symbol in zip(page.locator('.chord-card').all(), ['C#m7','Amaj7','F#m7','G#m7']):
            expect(card).to_contain_text(symbol)
        expect(page.locator('.chord-card').first).to_contain_text('1 timpi')
        page.get_by_role('button',name='Istoric',exact=True).click()
        expect(page.locator('.history-item')).to_have_count(2)
        page.get_by_role('button',name='Închide',exact=True).click()
        expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
        page.reload()
        expect(page.get_by_label('Tonalitate',exact=True)).to_have_value('C#')
        expect(page.get_by_label('Mod tonalitate',exact=True)).to_have_value('minor')
        expect(page.locator('.chord-card').first).to_contain_text('C#m7')
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
        page.get_by_role('button',name='Explorează C#m7, acordul 1',exact=True).click()
        check_tones([1,4,8,11])
        # The previously created C5 stays editable without becoming a highlighted chord tone.
        expect(page.locator('.note-lane-label[data-midi="72"]')).to_have_attribute('data-chord-tone','false')
        expect(page.get_by_role('button',name='C5, măsura 1, pas 1, notă existentă',exact=True)).to_be_visible()
        page.get_by_role('button',name='Harmony Studio',exact=True).click()
        page.get_by_label('Mod tonalitate',exact=True).select_option('major')
        page.get_by_label('Tonalitate',exact=True).select_option('G#')
        page.locator('.chord-card').nth(1).click()
        expect(page.get_by_label('Fundamentală în progresie',exact=True)).to_have_value('E#')
        expect(page.get_by_label('Fundamentală',exact=True)).to_have_value('E#')
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
        page.get_by_role('button',name='Explorează G#maj7, acordul 1',exact=True).click()
        check_tones([8,0,3,7])
        expect(page.locator('.note-lane-label[data-midi="72"]')).to_have_text('B#4')
        for width in [390,768,1440]:
            page.set_viewport_size({'width':width,'height':1000})
            assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'), width
        out=ROOT/'artifacts';out.mkdir(exist_ok=True)
        page.screenshot(path=str(out/'chord-guidance-desktop.png'),full_page=True)
        page.set_viewport_size({'width':390,'height':844})
        page.screenshot(path=str(out/'chord-guidance-mobile.png'),full_page=True)
        assert not errors, errors
        print(json.dumps({'result':'passed','checks':['all progression chords','28 chord qualities','chromatic altered chord','per-column guidance within measure','non-chord note editing','reload persistence','Harmony selection handoff','automatic major/minor progression regeneration','history and saved key','no piano keyboard','responsive 390/768/1440'],'browser_errors':errors}))
        browser.close()
finally:
    server.shutdown();server.server_close()
