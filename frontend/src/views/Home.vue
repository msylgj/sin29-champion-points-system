<template>
  <div class="home">
    <el-card class="welcome-card">
      <template #header>
        <div class="card-header">
          <span>欢迎使用射箭赛事积分统计系统</span>
        </div>
      </template>
      <div class="content">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-statistic title="运动员总数" :value="statistics.athletes">
              <template #suffix>人</template>
            </el-statistic>
          </el-col>
          <el-col :span="8">
            <el-statistic title="赛事总数" :value="statistics.events">
              <template #suffix>场</template>
            </el-statistic>
          </el-col>
          <el-col :span="8">
            <el-statistic title="积分记录" :value="statistics.scores">
              <template #suffix>条</template>
            </el-statistic>
          </el-col>
        </el-row>
        <el-divider />
        <div class="api-test">
          <h3>API 连接状态</h3>
          <el-button @click="testConnection" type="primary">测试后端连接</el-button>
          <p v-if="apiStatus" :class="apiStatus.success ? 'success' : 'error'">
            {{ apiStatus.message }}
          </p>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const statistics = ref({
  athletes: 0,
  events: 0,
  scores: 0
})

const apiStatus = ref(null)

const testConnection = async () => {
  try {
    const response = await api.get('/health')
    apiStatus.value = {
      success: true,
      message: '后端连接成功！'
    }
    ElMessage.success('后端连接成功！')
  } catch (error) {
    apiStatus.value = {
      success: false,
      message: '后端连接失败: ' + (error.message || '未知错误')
    }
    ElMessage.error('后端连接失败')
  }
}

onMounted(async () => {
  await testConnection()
})
</script>

<style scoped>
.home {
  max-width: 1200px;
  margin: 0 auto;
}

.welcome-card {
  margin-top: 20px;
}

.card-header {
  font-size: 18px;
  font-weight: bold;
}

.content {
  padding: 20px 0;
}

.api-test {
  text-align: center;
  padding: 20px 0;
}

.api-test h3 {
  margin-bottom: 20px;
}

.success {
  color: #67c23a;
  font-weight: bold;
  margin-top: 15px;
}

.error {
  color: #f56c6c;
  font-weight: bold;
  margin-top: 15px;
}
</style>
