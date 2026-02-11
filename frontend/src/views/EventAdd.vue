<template>
  <div class="event-add-page safe-area">
    <div class="page-header">
      <h1>新增赛事</h1>
      <p class="subtitle">添加赛事并配置参赛信息</p>
    </div>

    <form @submit.prevent="submitForm" class="form-container">
      <!-- 基本信息 -->
      <div class="section">
        <h2 class="section-title">基本信息</h2>
        
        <div class="form-group">
          <label for="year">年度 *</label>
          <input 
            id="year"
            v-model.number="formData.year" 
            type="number" 
            :min="currentYear - 10" 
            :max="currentYear + 10"
            required
            class="form-input"
            placeholder="如：2024"
          />
          <small class="help-text">请选择赛事举办年度</small>
        </div>

        <div class="form-group">
          <label for="season">赛季 *</label>
          <select v-model="formData.season" id="season" required class="form-input">
            <option value="">请选择赛季</option>
            <option value="Q1">Q1（1-3月）</option>
            <option value="Q2">Q2（4-6月）</option>
            <option value="Q3">Q3（7-9月）</option>
            <option value="Q4">Q4（10-12月）</option>
          </select>
          <small class="help-text">选择赛事所属的季度</small>
        </div>
      </div>

      <!-- 赛事配置 -->
      <div class="section">
        <h2 class="section-title">赛事配置</h2>
        <p class="section-help">为每种弓的每个距离添加配置</p>

        <div 
          v-for="(config, index) in formData.configurations" 
          :key="index"
          class="config-card"
        >
          <div class="config-header">
            <span class="config-number">配置 {{ index + 1 }}</span>
            <button 
              v-if="formData.configurations.length > 1"
              type="button"
              @click="removeConfig(index)"
              class="btn-remove"
            >
              删除
            </button>
          </div>

          <div class="config-fields">
            <div class="form-group">
              <label :for="`bow-type-${index}`">弓种 *</label>
              <select 
                :id="`bow-type-${index}`"
                v-model="config.bow_type" 
                required
                class="form-input"
              >
                <option value="">请选择弓种</option>
                <option value="recurve">反曲弓</option>
                <option value="compound">复合弓</option>
                <option value="barebow">光弓</option>
                <option value="traditional">传统弓</option>
              </select>
            </div>

            <div class="form-group">
              <label :for="`distance-${index}`">距离 *</label>
              <select 
                :id="`distance-${index}`"
                v-model="config.distance" 
                required
                class="form-input"
              >
                <option value="">请选择距离</option>
                <option value="18m">18米</option>
                <option value="25m">25米</option>
                <option value="30m">30米</option>
                <option value="50m">50米</option>
                <option value="70m">70米</option>
              </select>
            </div>

            <div class="form-group">
              <label :for="`format-${index}`">赛制 *</label>
              <select 
                :id="`format-${index}`"
                v-model="config.format" 
                required
                class="form-input"
              >
                <option value="">请选择赛制</option>
                <option value="ranking">排名赛</option>
                <option value="elimination">淘汰赛</option>
                <option value="mixed_doubles">混双赛</option>
                <option value="team">团体赛</option>
              </select>
            </div>

            <div class="form-group">
              <label :for="`participant-count-${index}`">参赛人数 *</label>
              <input 
                :id="`participant-count-${index}`"
                v-model.number="config.participant_count" 
                type="number" 
                min="1"
                max="999"
                required
                class="form-input"
                placeholder="如：24"
              />
              <small class="help-text">用于计算积分系数</small>
            </div>
          </div>
        </div>

        <button type="button" @click="addConfig" class="btn-add-config">
          + 添加配置
        </button>
      </div>

      <!-- 提交按钮 -->
      <div class="form-actions">
        <button type="button" @click="$router.back()" class="btn-cancel">
          取消
        </button>
        <button type="submit" class="btn-submit" :disabled="loading">
          {{ loading ? '保存中...' : '保存赛事' }}
        </button>
      </div>
    </form>

    <!-- 成功提示 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>

    <!-- 错误提示 -->
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI } from '@/api'

const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const formData = ref({
  year: currentYear,
  season: '',
  configurations: [
    { bow_type: '', distance: '', format: '', participant_count: null }
  ]
})

const addConfig = () => {
  formData.value.configurations.push({
    bow_type: '',
    distance: '',
    format: '',
    participant_count: null
  })
}

const removeConfig = (index) => {
  formData.value.configurations.splice(index, 1)
}

const submitForm = async () => {
  if (!formData.value.season) {
    errorMessage.value = '请选择赛季'
    return
  }

  if (formData.value.configurations.some(c => !c.bow_type || !c.distance || !c.format || !c.participant_count)) {
    errorMessage.value = '请完整填写所有配置信息'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const response = await eventAPI.createWithConfigs(formData.value)
    successMessage.value = '赛事添加成功'
    setTimeout(() => {
      router.push('/score-import')
    }, 1500)
  } catch (error) {
    errorMessage.value = error.message || '添加失败，请重试'
    console.error('Error creating event:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.event-add-page {
  padding-bottom: 100px;
  background-color: #f5f5f5;
}

.page-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px 20px 20px;
  margin-bottom: 20px;

  h1 {
    margin: 0 0 5px;
    font-size: 28px;
    font-weight: 600;
  }

  .subtitle {
    margin: 0;
    opacity: 0.9;
    font-size: 14px;
  }
}

.form-container {
  padding: 0 15px;

  .section {
    background: white;
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 20px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 0 0 10px;
      color: #333;
    }

    .section-help {
      font-size: 12px;
      color: #999;
      margin: 0 0 15px;
    }
  }
}

.form-group {
  margin-bottom: 15px;

  label {
    display: block;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 6px;
    color: #333;
  }

  .form-input {
    width: 100%;
    padding: 10px 12px;
    border: 1px solid #ddd;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;

    &:focus {
      outline: none;
      border-color: #667eea;
      box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }

    &:disabled {
      background-color: #f0f0f0;
      cursor: not-allowed;
    }
  }

  .help-text {
    display: block;
    font-size: 12px;
    color: #999;
    margin-top: 4px;
  }
}

.config-card {
  background: #f9f9f9;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 15px;
  margin-bottom: 15px;

  .config-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .config-number {
      font-size: 13px;
      font-weight: 600;
      color: #666;
    }

    .btn-remove {
      padding: 4px 12px;
      background: #ff4757;
      color: white;
      border: none;
      border-radius: 4px;
      font-size: 12px;
      cursor: pointer;

      &:hover {
        background: #ff3838;
      }
    }
  }

  .config-fields {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;

    .form-group:nth-child(2n + 1),
    .form-group:nth-child(2n) {
      margin-bottom: 0;
    }
  }
}

.btn-add-config {
  width: 100%;
  padding: 12px;
  background: #f0f0f0;
  border: 2px dashed #ccc;
  border-radius: 6px;
  font-size: 14px;
  color: #666;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    background: #e8e8e8;
    border-color: #999;
    color: #333;
  }
}

.form-actions {
  display: flex;
  gap: 10px;
  padding: 0 15px 20px;
  margin-top: 20px;

  .btn-cancel,
  .btn-submit {
    flex: 1;
    padding: 12px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s;
  }

  .btn-cancel {
    background: #f0f0f0;
    color: #333;

    &:hover {
      background: #e0e0e0;
    }
  }

  .btn-submit {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    &:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  }
}

.success-message {
  position: fixed;
  bottom: 90px;
  left: 15px;
  right: 15px;
  padding: 12px 15px;
  background: #2ed573;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  animation: slideUp 0.3s ease;
}

.error-message {
  position: fixed;
  bottom: 90px;
  left: 15px;
  right: 15px;
  padding: 12px 15px;
  background: #ff4757;
  color: white;
  border-radius: 6px;
  font-size: 14px;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

@media (max-width: 480px) {
  .config-card .config-fields {
    grid-template-columns: 1fr;
  }
}
</style>
