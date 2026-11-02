"""Functional browser checks. Requires Python Playwright and a local Chromium.
Run against npm run dev (or production preview) using GCS_BASE_URL.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('GCS_BASE_URL', 'http://127.0.0.1:5173')
ARTIFACTS = Path(__file__).resolve().parents[1] / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context(viewport={'width': 1440, 'height': 1100}, accept_downloads=True)
    context.add_init_script('''
      window.__audioEvents = [];
      const originalStart = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function(at) {
        window.__audioEvents.push({at, frequency: this.frequency.value, state: this.context.state});
        return originalStart.call(this, at);
      };
    ''')
    if os.environ.get('GCS_STANDALONE') == '1':
        context.route('**/*', lambda route: route.continue_() if route.request.is_navigation_request() else route.abort())
    page = context.new_page()
    page.set_default_timeout(10000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(BASE_URL)
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    expect(page.locator('.chord-card')).to_have_count(4)
    page.get_by_label('Nume proiect', exact=True).fill('Browser test composition')
    page.get_by_role('button', name='Adaugă acord', exact=True).click()
    page.get_by_label('Fundamentală', exact=True).last.select_option('F')
    page.get_by_label('Tip acord', exact=True).last.select_option('m7')
    page.get_by_label('Note în notație internațională, cu basul primul').fill('C E G')
    expect(page.locator('.identify-results')).to_contain_text('CM')
    page.get_by_role('button', name='Adaugă în progresie').click()
    expect(page.locator('.chord-card')).to_have_count(5)
    expect(page.locator('.selected-chord strong')).to_have_text('Fm7')
    page.get_by_role('button', name='Mută acordul la stânga', exact=True).click()
    expect(page.locator('.chord-card').nth(3)).to_contain_text('Fm7')
    page.get_by_label('Inversiune', exact=True).select_option('1')
    expect(page.locator('.selected-chord strong')).to_have_text('Fm7/Ab')
    page.get_by_label('Durată', exact=True).select_option('8')
    page.get_by_role('button', name='Duplică acordul', exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(6)
    expect(page.get_by_label('Durată', exact=True)).to_have_value('8')
    page.get_by_role('button', name='Șterge acordul', exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(5)
    page.get_by_label('Tempo BPM', exact=True).fill('120')
    page.get_by_label('Arată gama', exact=True).check()
    expect(page.locator('.scale-tone')).not_to_have_count(0)
    page.get_by_role('button', name='Salvează versiune', exact=True).click()
    page.get_by_role('button', name='Istoric', exact=True).click()
    expect(page.locator('.history-item')).to_have_count(1)
    page.get_by_role('button', name='Închide', exact=True).click()
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    page.reload()
    expect(page.get_by_label('Nume proiect', exact=True)).to_have_value('Browser test composition')
    expect(page.locator('.chord-card')).to_have_count(5)
    expect(page.get_by_label('Tempo BPM', exact=True)).to_have_value('120')
    # Audio scheduling is observed; perceived sound and hardware latency are not tested.
    page.get_by_role('button', name='Redă progresia', exact=True).click()
    expect(page.get_by_role('button', name='Oprește progresia', exact=True)).to_be_visible()
    page.wait_for_function('window.__audioEvents.length >= 4')
    events = page.evaluate('window.__audioEvents')
    assert all(e['state'] == 'running' and e['frequency'] > 0 for e in events)
    page.get_by_role('button', name='Oprește progresia', exact=True).click()
    expect(page.get_by_role('button', name='Redă progresia', exact=True)).to_be_visible()
    with page.expect_download() as download:
        page.get_by_role('button', name='Exportă', exact=True).click()
    exported = ARTIFACTS / 'browser-project.gcs.json'
    download.value.save_as(exported)
    data = json.loads(exported.read_text())
    assert len(data['chords']) == 5 and len(data['revisions']) == 1
    # Invalid imports leave the current project intact.
    page.locator('input[type=file]').set_input_files({'name': 'bad.json', 'mimeType': 'application/json', 'buffer': b'{"schemaVersion":99}'})
    expect(page.get_by_text('Versiune de proiect incompatibilă. Sunt acceptate versiunile 1 și 2.', exact=True)).to_be_visible()
    expect(page.locator('.chord-card')).to_have_count(5)
    page.locator('input[type=file]').set_input_files(str(exported))
    expect(page.get_by_text('Proiect importat ca o copie nouă.', exact=True)).to_be_visible()
    page.get_by_role('button', name='Biblioteca mea', exact=True).click()
    expect(page.locator('.library-project')).to_have_count(2)
    # Delete an imported copy without accidentally recreating it through autosave.
    page.once('dialog', lambda dialog: dialog.accept())
    page.locator('.library-project').first.get_by_role('button', name='Șterge proiectul Browser test composition', exact=True).click()
    expect(page.locator('.library-project')).to_have_count(1)
    page.wait_for_timeout(700)
    assert page.evaluate("""async () => {
      const db = await new Promise((resolve,reject) => { const r=indexedDB.open('guitar-composer-studio',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error); });
      return await new Promise(resolve => {const r=db.transaction('projects').objectStore('projects').count();r.onsuccess=()=>{db.close();resolve(r.result);};});
    }""") == 1
    page.get_by_role('button', name='Deschide', exact=False).click()
    expect(page.locator('.chord-card')).to_have_count(5)
    page.get_by_role('button', name='Istoric', exact=True).click()
    page.get_by_role('button', name='Restaurează', exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(5)
    page.get_by_role('button', name='Istoric', exact=True).click()
    expect(page.locator('.history-item')).to_have_count(2)
    page.get_by_role('button', name='Închide', exact=True).click()
    assert not page.evaluate('document.documentElement.scrollWidth > innerWidth')
    page.screenshot(path=str(ARTIFACTS / 'studio-desktop.png'), full_page=True)
    page.get_by_role('button', name='Proiect nou', exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(0)
    expect(page.get_by_text('Prima idee începe cu un acord.', exact=True)).to_be_visible()
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    # Responsive screenshots in independent storage contexts.
    for width in [390, 768, 1024]:
        mobile = browser.new_page(viewport={'width': width, 'height': 844}, is_mobile=width == 390, has_touch=width == 390)
        if os.environ.get('GCS_STANDALONE') == '1':
            mobile.route('**/*', lambda route: route.continue_() if route.request.is_navigation_request() else route.abort())
        mobile.goto(BASE_URL)
        expect(mobile.get_by_text('Salvat local', exact=True)).to_be_visible()
        assert not mobile.evaluate('document.documentElement.scrollWidth > innerWidth'), f'Overflow at {width}px'
        if width == 390:
            mobile.screenshot(path=str(ARTIFACTS / 'studio-mobile.png'), full_page=True)
        mobile.close()
    assert not errors, errors
    print(json.dumps({'result': 'passed', 'checks': ['chord editing', 'reorder', 'inversion', 'duplicate/delete', 'tempo', 'scale overlay', 'autosave/reload', 'history/restore', 'audio scheduling', 'JSON export/import', 'invalid import', 'library/delete persistence', 'new empty project', 'responsive 390/768/1024/1440'], 'browser_errors': errors}))
    browser.close()
