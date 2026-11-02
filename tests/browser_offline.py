"""Offline production smoke test. Start npm run preview first."""
import json
import os
from playwright.sync_api import sync_playwright, expect

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'), headless=True, args=['--no-sandbox'])
    context = browser.new_context()
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(os.environ.get('GCS_BASE_URL', 'http://127.0.0.1:4173'))
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    page.evaluate('navigator.serviceWorker.ready.then(() => true)')
    page.get_by_label('Nume proiect', exact=True).fill('Offline composition')
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    context.set_offline(True)
    page.reload()
    expect(page.get_by_label('Nume proiect', exact=True)).to_have_value('Offline composition')
    assert page.evaluate('navigator.serviceWorker.controller !== null')
    expect(page.locator('.chord-card')).to_have_count(4)
    page.get_by_role('button', name='Adaugă acord', exact=True).click()
    page.get_by_label('Fundamentală', exact=True).last.select_option('D')
    page.get_by_role('button', name='Adaugă în progresie', exact=True).click()
    expect(page.locator('.chord-card')).to_have_count(5)
    expect(page.locator('.selected-chord strong')).to_have_text('Dmaj7')
    expect(page.get_by_text('Salvat local', exact=True)).to_be_visible()
    page.reload()
    expect(page.locator('.chord-card')).to_have_count(5)
    assert not errors, errors
    print(json.dumps({'result': 'passed', 'checks': ['production service worker', 'offline reload', 'offline theory/edit', 'offline IndexedDB persistence'], 'browser_errors': errors}))
    browser.close()
