"""Composition regression: legacy migration, melody, backing, MIDI and rendered WAV."""
import json
import os
import struct
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE_URL = os.environ.get('GCS_BASE_URL','http://127.0.0.1:4173')
ARTIFACTS = Path(__file__).resolve().parents[1] / 'artifacts'
ARTIFACTS.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1440,'height':1050},accept_downloads=True)
    if os.environ.get('GCS_STANDALONE')=='1':
        context.route('**/*',lambda route:route.continue_() if route.request.is_navigation_request() else route.abort())
    page=context.new_page()
    page.set_default_timeout(12000)
    errors=[]
    page.on('pageerror',lambda error:errors.append(str(error)))
    page.goto(BASE_URL)
    expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
    # Seed an actual v1 IndexedDB record, not just a JSON object passed to a function.
    page.evaluate('''async () => {
      const db = await new Promise((resolve,reject)=>{const r=indexedDB.open('guitar-composer-studio',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const old = await new Promise(resolve=>{const r=db.transaction('projects').objectStore('projects').getAll();r.onsuccess=()=>resolve(r.result[0]);});
      old.schemaVersion=1;old.name='Legacy song';delete old.melody;delete old.backing;
      await new Promise((resolve,reject)=>{const tx=db.transaction('projects','readwrite');tx.objectStore('projects').put(old);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});
      db.close();
    }''')
    page.reload()
    expect(page.get_by_label('Nume proiect',exact=True)).to_have_value('Legacy song')
    page.get_by_role('button',name='Solo & Melody',exact=True).click()
    page.get_by_role('button',name='C5, măsura 1, pas 1',exact=True).click()
    page.get_by_label('Durată notă selectată',exact=True).select_option('1')
    page.get_by_label('Poziție notă selectată',exact=True).fill('0.25')
    expect(page.get_by_role('button',name='C5, măsura 1, pas 2, notă existentă',exact=True)).to_have_attribute('aria-pressed','true')
    expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
    page.reload()
    page.get_by_role('button',name='Solo & Melody',exact=True).click()
    page.get_by_role('button',name='C5, măsura 1, pas 2, notă existentă',exact=True).click()
    expect(page.get_by_label('Durată notă selectată',exact=True)).to_have_value('1')
    page.get_by_role('button',name='Șterge nota',exact=True).click()
    expect(page.locator('.note-start')).to_have_count(0)
    page.get_by_role('button',name='Generează schiță',exact=True).click()
    expect(page.locator('.note-start')).not_to_have_count(0)
    expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
    page.get_by_role('button',name='Istoric',exact=True).click()
    expect(page.locator('.history-item')).to_have_count(1)
    page.get_by_role('button',name='Închide',exact=True).click()
    page.screenshot(path=str(ARTIFACTS/'solo-desktop.png'),full_page=True)
    page.get_by_role('button',name='Backing & Export',exact=True).click()
    page.get_by_label('Activează acompaniamentul',exact=True).check()
    page.get_by_label('Stil acompaniament',exact=True).select_option('shuffle')
    page.get_by_role('button',name='Solo Bas',exact=True).click()
    expect(page.locator('.mixer-strip.audible')).to_have_count(1)
    page.get_by_role('button',name='Solo Bas',exact=True).click()
    page.get_by_role('button',name='Mute Tobe',exact=True).click()
    expect(page.locator('.mixer-strip.audible')).to_have_count(3)
    page.get_by_role('button',name='Mute Tobe',exact=True).click()
    page.get_by_role('button',name='Redă progresia',exact=True).click()
    expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
    page.get_by_role('button',name='Oprește progresia',exact=True).click()
    # MIDI and WAV must be real, independently readable downloads.
    with page.expect_download() as midi_download:
        page.get_by_role('button',name='Exportă MIDI',exact=True).click()
    midi_path=ARTIFACTS/'composition.mid'
    midi_download.value.save_as(midi_path)
    midi=midi_path.read_bytes()
    assert midi[:4]==b'MThd' and struct.unpack('>H',midi[10:12])[0]==5
    assert midi.count(b'MTrk')==5
    with page.expect_download(timeout=60000) as wav_download:
        page.get_by_role('button',name='Exportă WAV',exact=True).click()
    wav_path=ARTIFACTS/'composition.wav'
    wav_download.value.save_as(wav_path)
    wav=wav_path.read_bytes()
    assert wav[:4]==b'RIFF' and wav[8:12]==b'WAVE'
    assert struct.unpack('<I',wav[24:28])[0]==44100
    assert struct.unpack('<H',wav[22:24])[0]==2
    assert len(wav)>1_000_000 and any(wav[44:]),'Rendered WAV must contain nonzero audio'
    expect(page.get_by_role('button',name='Exportă WAV',exact=True)).to_be_enabled()
    with page.expect_download() as project_download:
        page.get_by_role('button',name='Exportă',exact=True).click()
    project_path=ARTIFACTS/'composition.gcs.json'
    project_download.value.save_as(project_path)
    data=json.loads(project_path.read_text())
    assert data['schemaVersion']==3 and len(data['melody'])>16 and data['backing']['style']=='shuffle'
    assert len(data['revisions'])==1 and data['revisions'][0]['arrangement']['melody']==[]
    page.screenshot(path=str(ARTIFACTS/'backing-desktop.png'),full_page=True)
    # Restore pre-generation state. All composition fields, including mix, must restore.
    page.get_by_role('button',name='Istoric',exact=True).click()
    page.get_by_role('button',name='Restaurează',exact=True).click()
    page.get_by_role('button',name='Solo & Melody',exact=True).click()
    expect(page.locator('.note-start')).to_have_count(0)
    # Solo-only projects can play without harmony.
    page.get_by_role('button',name='Proiect nou',exact=True).click()
    page.get_by_role('button',name='C5, măsura 1, pas 1',exact=True).click()
    page.get_by_role('button',name='Redă progresia',exact=True).click()
    expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
    page.get_by_role('button',name='Oprește progresia',exact=True).click()
    # A short melody-only one-shot must finish, while loop mode must keep playing.
    page.get_by_label('Durată notă selectată',exact=True).select_option('0.25')
    page.get_by_label('Tempo BPM',exact=True).fill('240')
    page.get_by_role('button',name='Repetă progresia',exact=True).click()
    page.get_by_role('button',name='Redă progresia',exact=True).click()
    expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Redă progresia',exact=True)).to_be_visible(timeout=5000)
    page.get_by_role('button',name='Repetă progresia',exact=True).click()
    page.get_by_role('button',name='Redă progresia',exact=True).click()
    page.wait_for_timeout(500)
    expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
    page.get_by_role('button',name='Oprește progresia',exact=True).click()
    for width in [390,768]:
        page.set_viewport_size({'width':width,'height':844})
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'Overflow at {width}'
        if width==390:page.screenshot(path=str(ARTIFACTS/'solo-mobile.png'),full_page=True)
        page.get_by_role('button',name='Backing & Export',exact=True).click()
        assert not page.evaluate('document.documentElement.scrollWidth > innerWidth'),f'Backing overflow at {width}'
        page.get_by_role('button',name='Solo & Melody',exact=True).click()
    assert not errors,errors
    print(json.dumps({'result':'passed','checks':['v1 IndexedDB migration','melody create/edit/move/delete','reload persistence','seeded generator and checkpoint','mute/solo','combined/melody-only transport and loop/one-shot completion','five-track MIDI download','nonzero stereo WAV render','v3 interchange','history restores composition','390/768 layouts'],'browser_errors':errors}))
    browser.close()
