import { createApp } from 'vue';
import App from './App.vue';
import './styles/main.css';

async function enableEdgeToEdge(): Promise<void> {
  try {
    const ksu = (window as any).ksu;
    if (ksu && typeof ksu.enableEdgeToEdge === 'function') {
      ksu.enableEdgeToEdge(true);
    }
  } catch {
    /* outside KernelSU WebView */
  }
}

enableEdgeToEdge();
createApp(App).mount('#app');
