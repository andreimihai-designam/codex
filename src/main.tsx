import React from 'react';
import ReactDOM from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import './styles.css';

registerSW({
  immediate: true,
  // Let the app offer a reload after edits are saved; never interrupt recording.
  onNeedReload: () => window.dispatchEvent(new Event('gcs:update-ready')),
});
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
