import { ref, onMounted } from 'vue';

export function useDarkMode() {
  const isDark = ref(localStorage.getItem('fv_theme') === 'dark');

  function applyTheme(dark: boolean) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('fv_theme', dark ? 'dark' : 'light');
  }

  function toggle() {
    isDark.value = !isDark.value;
    applyTheme(isDark.value);
  }

  onMounted(() => applyTheme(isDark.value));

  return { isDark, toggle };
}
