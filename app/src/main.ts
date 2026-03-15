import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { configureAmplify } from './config/amplify';
import router from './router';
import './style.css';

configureAmplify();

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.mount('#app');
