"""Real browser media/backup tests + explicitly mocked AI HTTP contract tests.
No real microphone, Focusrite driver, or LLM inference is claimed by this runner.
"""
import io
import json
import math
import os
import struct
import wave
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

BASE=os.environ.get('GCS_BASE_URL','http://127.0.0.1:4173')
OUT=Path(__file__).resolve().parents[1]/'artifacts'
OUT.mkdir(exist_ok=True)
stream=io.BytesIO()
with wave.open(stream,'wb') as w:
    w.setnchannels(1);w.setsampwidth(2);w.setframerate(44100)
    w.writeframes(b''.join(struct.pack('<h',int(9000*math.sin(i*2*math.pi*440/44100))) for i in range(22050)))
fixture={'name':'test-guitar.wav','mimeType':'audio/wav','buffer':stream.getvalue()}
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'])
    context=browser.new_context(viewport={'width':1440,'height':1000},accept_downloads=True)
    if os.environ.get('GCS_STANDALONE')=='1':
        context.route('**/*',lambda route:route.continue_() if route.request.is_navigation_request() else route.abort())
    page=context.new_page();page.set_default_timeout(15000)
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(BASE)
    expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
    page.get_by_role('button',name='Proiect nou',exact=True).click()
    page.get_by_role('button',name='Audio Studio',exact=True).click()
    page.locator('input[accept^="audio/"]').set_input_files(fixture)
    expect(page.locator('.audio-clip')).to_have_count(1)
    expect(page.locator('.audio-clip svg polygon')).to_have_count(1)
    page.get_by_label('Panoramare pistă',exact=True).press('End')
    page.get_by_label('Trim început',exact=True).fill('0.1')
    page.get_by_label('Trim sfârșit',exact=True).fill('0.4')
    page.get_by_label('Cursor audio',exact=True).fill('0.3')
    page.get_by_role('button',name='Taie la cursor',exact=True).click()
    expect(page.locator('.audio-clip')).to_have_count(2)
    page.get_by_role('button',name='Mute pistă audio',exact=True).click()
    expect(page.get_by_role('button',name='Mute pistă audio',exact=True)).to_have_attribute('aria-pressed','true')
    page.get_by_role('button',name='Mute pistă audio',exact=True).click()
    page.get_by_role('button',name='Solo pistă audio',exact=True).click()
    page.get_by_role('button',name='Redă progresia',exact=True).click()
    expect(page.get_by_role('button',name='Oprește progresia',exact=True)).to_be_visible()
    page.wait_for_timeout(300)
    page.get_by_role('button',name='Oprește progresia',exact=True).click()
    with page.expect_download() as wav_download:
        page.get_by_role('button',name='Exportă mix WAV',exact=True).click()
    wav_path=OUT/'recorded-mix.wav';wav_download.value.save_as(wav_path)
    with wave.open(str(wav_path),'rb') as w:
        assert w.getnchannels()==2 and w.getframerate()==44100
        pcm=w.readframes(w.getnframes())
    samples=struct.unpack('<'+'h'*(len(pcm)//2),pcm)
    left=sum(x*x for x in samples[::2]);right=sum(x*x for x in samples[1::2])
    assert right>10000 and left<right*0.001,'Rendered mix must contain real audio and honor pan-right'
    with page.expect_download() as bundle_download:
        page.get_by_role('button',name='Backup complet .gcsbundle',exact=True).click()
    bundle_path=OUT/'studio.gcsbundle';bundle_download.value.save_as(bundle_path)
    bundle=bundle_path.read_bytes();assert bundle[:4]==b'GCSB'
    length=struct.unpack('<I',bundle[4:8])[0];manifest=json.loads(bundle[8:8+length])
    assert manifest['project']['schemaVersion']==3 and len(manifest['files'])==1
    assert len(manifest['project']['audio']['tracks'][0]['clips'])==2
    corrupt=bytearray(bundle);corrupt[-1]^=1
    page.locator('input[accept^=".json"]').set_input_files({'name':'corrupt.gcsbundle','mimeType':'application/octet-stream','buffer':bytes(corrupt)})
    expect(page.get_by_text('Integritatea sursei audio nu corespunde backup-ului (SHA-256).',exact=True)).to_be_visible()
    expect(page.locator('.audio-clip')).to_have_count(2)
    # Erase the media store to prove the bundle restores bytes, not just references.
    page.evaluate('''async()=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('guitar-composer-media',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('assets','readwrite');tx.objectStore('assets').clear();tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});db.close();}''')
    page.locator('input[accept^=".json"]').set_input_files(str(bundle_path))
    expect(page.get_by_text('Proiect importat ca o copie nouă.',exact=True)).to_be_visible()
    expect(page.locator('.audio-clip')).to_have_count(2)
    with page.expect_download() as restored_download:
        page.get_by_role('button',name='Exportă mix WAV',exact=True).click()
    restored=OUT/'restored-mix.wav';restored_download.value.save_as(restored)
    assert restored.read_bytes()==wav_path.read_bytes(),'Restored source bytes and mix must remain identical'
    page.get_by_role('button',name='Istoric',exact=True).click()
    page.locator('.history-item').first.get_by_role('button',name='Restaurează',exact=True).click()
    expect(page.locator('.audio-clip')).to_have_count(1)
    page.screenshot(path=str(OUT/'audio-studio.png'),full_page=True)
    # Fake WebRTC input exercises real MediaRecorder, decoding and durable WAV storage.
    page.get_by_role('button',name='Proiect nou',exact=True).click()
    page.get_by_label('Acompaniament la înregistrare',exact=True).uncheck()
    page.get_by_role('button',name='Detectează intrări',exact=True).click()
    expect(page.get_by_role('button',name='Înregistrează',exact=True)).to_be_enabled()
    page.get_by_role('button',name='Înregistrează',exact=True).click()
    expect(page.get_by_role('button',name='Oprește înregistrarea',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Proiect nou',exact=True)).to_be_disabled()
    page.wait_for_timeout(1400)
    page.get_by_role('button',name='Oprește înregistrarea',exact=True).click()
    expect(page.locator('.audio-clip')).to_have_count(1,timeout=30000)
    expect(page.get_by_text('Salvat local',exact=True)).to_be_visible()
    page.reload();page.get_by_role('button',name='Audio Studio',exact=True).click()
    expect(page.locator('.audio-clip')).to_have_count(1)
    # Explicitly mocked Ollama transport. This does not prove model inference.
    requests=[]
    def mock_ollama(route):
        if route.request.method=='OPTIONS':
            route.fulfill(status=204,headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'})
            return
        if route.request.url.endswith('/api/tags'):
            data={'models':[{'name':'qwen2.5:3b'}]}
        else:
            body=route.request.post_data_json;requests.append(body)
            prompt=body['messages'][-1]['content']
            reply={'answer':'Propun Dm7–G7–Cmaj7, cu rezolvare pe tonică.','progression':[{'root':'D','quality':'m7','beats':4},{'root':'G','quality':'7','beats':4},{'root':'C','quality':'maj7','beats':4}]}
            if prompt=='invalid proposal':reply={'answer':'invalid','progression':[{'root':'H','quality':'m','beats':4}]}
            data={'message':{'content':json.dumps(reply)}}
        route.fulfill(status=200,content_type='application/json',body=json.dumps(data),headers={'Access-Control-Allow-Origin':'*'})
    context.route('http://127.0.0.1:11434/**',mock_ollama)
    page.get_by_role('button',name='Asistent AI',exact=True).click()
    page.get_by_role('button',name='Verifică și listează modelele',exact=True).click()
    expect(page.get_by_text('Server conectat · 1 modele disponibile',exact=True)).to_be_visible()
    page.get_by_label('Mesaj pentru AI',exact=True).fill('Propune o progresie')
    page.get_by_role('button',name='Trimite către AI',exact=True).click()
    expect(page.get_by_role('button',name='Aplică propunerea',exact=True)).to_be_visible()
    assert requests[0]['options']['num_predict']==1024 and requests[0]['stream'] is False
    assert 'test-guitar' not in requests[0]['messages'][0]['content']
    page.get_by_role('button',name='Aplică propunerea',exact=True).click()
    page.get_by_role('button',name='Harmony Studio',exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(3)
    expect(page.locator('.chord-card').first).to_contain_text('Dm7')
    page.get_by_role('button',name='Asistent AI',exact=True).click()
    expect(page.locator('.chat-message.assistant')).to_have_count(1)
    page.get_by_label('Mesaj pentru AI',exact=True).fill('invalid proposal')
    page.get_by_role('button',name='Trimite către AI',exact=True).click()
    expect(page.locator('.ai-error')).to_contain_text('necunoscut')
    page.get_by_role('button',name='Harmony Studio',exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(3)
    page.get_by_role('button',name='Asistent AI',exact=True).click()
    # A one-request budget must also reject form submission outside the disabled button.
    page.get_by_role('button',name='Resetează contorul',exact=True).click()
    page.get_by_label('Buget cereri AI',exact=True).fill('1')
    page.get_by_label('Mesaj pentru AI',exact=True).fill('Propune din nou')
    page.get_by_role('button',name='Trimite către AI',exact=True).click()
    expect(page.get_by_role('button',name='Aplică propunerea',exact=True)).to_be_visible()
    expect(page.get_by_role('button',name='Trimite către AI',exact=True)).to_be_disabled()
    count=len(requests)
    page.locator('form.chat-input').evaluate('(form)=>form.requestSubmit()')
    expect(page.locator('.ai-error')).to_contain_text('Bugetul')
    assert len(requests)==count
    # Cancel a pending fetch: no invented assistant response is added.
    page.get_by_role('button',name='Resetează contorul',exact=True).click()
    page.evaluate('''()=>{window.__originalFetch=window.fetch;window.fetch=(url,options)=>String(url).endsWith('/api/chat')?new Promise((resolve,reject)=>{options.signal.addEventListener('abort',()=>reject(new DOMException('Canceled','AbortError')));if(options.signal.aborted)reject(new DOMException('Canceled','AbortError'));}):window.__originalFetch(url,options);}''')
    page.get_by_label('Mesaj pentru AI',exact=True).fill('Anulează această cerere')
    page.get_by_role('button',name='Trimite către AI',exact=True).click()
    page.get_by_role('button',name='Anulează cererea',exact=True).click()
    expect(page.locator('.ai-error')).to_contain_text('anulată')
    page.evaluate('()=>{window.fetch=window.__originalFetch;}')
    # Optional cloud adapter: verify key destination, token budget and no persistence.
    cloud_requests=[]
    def mock_cloud(route):
        headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'authorization,content-type'}
        if route.request.method=='OPTIONS':route.fulfill(status=204,headers=headers);return
        cloud_requests.append((route.request.all_headers(),route.request.post_data_json))
        route.fulfill(status=200,content_type='application/json',headers=headers,body=json.dumps({'choices':[{'message':{'content':json.dumps({'answer':'Răspuns cloud de test.'})}}]}))
    context.route('https://llm.example/**',mock_cloud)
    page.get_by_role('button',name='Resetează contorul',exact=True).click()
    page.get_by_label('Furnizor AI',exact=True).select_option('cloud')
    page.get_by_label('Adresă server AI',exact=True).fill('https://llm.example/v1')
    page.get_by_label('Model AI',exact=True).fill('test-model')
    page.get_by_label('Cheie API cloud',exact=True).fill('test-key-not-a-secret')
    page.get_by_label('Limită tokeni AI',exact=True).select_option('256')
    page.get_by_label('Mesaj pentru AI',exact=True).fill('Explică progresia')
    page.get_by_role('button',name='Trimite către AI',exact=True).click()
    expect(page.get_by_text('Răspuns cloud de test.',exact=True)).to_be_visible()
    assert cloud_requests[0][0]['authorization']=='Bearer test-key-not-a-secret'
    assert cloud_requests[0][1]['max_tokens']==256
    assert 'test-key-not-a-secret' not in page.evaluate('JSON.stringify(localStorage)')
    with page.expect_download() as chat_backup:
        page.get_by_role('button',name='Exportă',exact=True).click()
    chat_bundle=OUT/'studio-chat.gcsbundle';chat_backup.value.save_as(chat_bundle)
    raw=chat_bundle.read_bytes();length=struct.unpack('<I',raw[4:8])[0];saved=json.loads(raw[8:8+length])
    assert any(m['content']=='Răspuns cloud de test.' for m in saved['chat'])
    assert 'test-key-not-a-secret' not in json.dumps(saved)
    page.get_by_role('button',name='Audio Studio',exact=True).click()
    page.get_by_role('button',name='Asistent AI',exact=True).click()
    expect(page.get_by_label('Cheie API cloud',exact=True)).to_have_value('')
    page.evaluate('window.scrollTo(0,0)')
    page.screenshot(path=str(OUT/'assistant.png'),full_page=True)
    for width in [390,768]:
        page.set_viewport_size({'width':width,'height':844})
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'AI overflow at {width}'
        page.get_by_role('button',name='Audio Studio',exact=True).click()
        assert not page.evaluate('document.documentElement.scrollWidth>innerWidth'),f'Audio overflow at {width}'
        if width==390:page.screenshot(path=str(OUT/'audio-mobile.png'),full_page=True)
        page.get_by_role('button',name='Asistent AI',exact=True).click()
    assert not errors,errors
    print(json.dumps({'result':'passed','real_browser_checks':['audio decoding/import','waveform','trim/split','playback','pan-correct PCM render','complete bundle source restoration','history','fake-device MediaRecorder capture','recording persistence','responsive layouts'],'mocked_AI_checks':['Ollama models/chat JSON protocol','validated preview/apply','conversation persistence','invalid proposal rejected','request budget enforced','request cancellation','cloud key isolation','chat backup without secrets'],'not_verified':['real Scarlett capture','ASIO/latency','real LLM inference'],'browser_errors':errors}))
    browser.close()
