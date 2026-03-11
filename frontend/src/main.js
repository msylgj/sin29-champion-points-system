import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

// 导入全局样式
import '@/styles/variables.scss'

const app = createApp(App)
app.use(router)

app.mount('#app')
