import { createApp } from 'vue';
import { setThemeMode } from 'miuix-vue';
import App from './App.vue';
import 'miuix-vue/style.css';
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

setThemeMode('system');
enableEdgeToEdge();
createApp(App).mount('#app');
