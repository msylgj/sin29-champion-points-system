import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'

// 导入全局样式
import '@/styles/variables.scss'

const app = createApp(App)

// Pinia 配置
const pinia = createPinia()

app.use(pinia)
app.use(router)

app.mount('#app')
