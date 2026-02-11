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
        <p class="section-help">为每种弓的每个赛制和距离组合填写参赛人数</p>

        <!-- 为每种弓创建一个表格 -->
        <div v-for="bowType in bowTypes" :key="bowType.code" class="bow-config-group">
          <h3 class="bow-type-title">{{ bowType.name }}</h3>
          
          <div class="table-wrapper">
            <table class="config-table">
              <thead>
                <tr>
                  <th>赛制</th>
                  <th v-for="distance in distances" :key="distance.code">
                    {{ distance.name }}
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="format in competitionFormats" :key="format.code">
                  <td class="format-label">{{ format.name }}</td>
                  <td v-for="distance in distances" :key="distance.code" class="input-cell">
                    <input 
                      v-model.number="configTable[bowType.code][format.code][distance.code]"
                      type="number"
                      min="0"
                      max="999"
                      class="table-input"
                      :placeholder="`0`"
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
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
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, dictionaryAPI } from '@/api'

const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

// 字典数据
const bowTypes = ref([])
const distances = ref([])
const competitionFormats = ref([])

const formData = ref({
  year: currentYear,
  season: ''
})

// 配置表数据结构：bow_type => format => distance => count
const configTable = ref({})

// 初始化配置表
const initConfigTable = () => {
  configTable.value = {}
  if (bowTypes.value.length && distances.value.length && competitionFormats.value.length) {
    bowTypes.value.forEach(bow => {
      configTable.value[bow.code] = {}
      competitionFormats.value.forEach(format => {
        configTable.value[bow.code][format.code] = {}
        distances.value.forEach(distance => {
          configTable.value[bow.code][format.code][distance.code] = 0
        })
      })
    })
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    const response = await dictionaryAPI.getAll()
    if (response.success && response.data) {
      bowTypes.value = response.data.bowTypes || []
      distances.value = response.data.distances || []
      competitionFormats.value = response.data.competitionFormats || []
      initConfigTable()
    }
  } catch (error) {
    console.error('加载字典数据失败:', error)
    errorMessage.value = '加载表单数据失败，请刷新重试'
  }
}

// 页面挂载时加载字典
onMounted(() => {
  loadDictionaries()
})

// 将表格数据转换为配置数组
const buildConfigurations = () => {
  const configs = []
  Object.entries(configTable.value).forEach(([bowType, formats]) => {
    Object.entries(formats).forEach(([format, distances_map]) => {
      Object.entries(distances_map).forEach(([distance, count]) => {
        if (count && count > 0) {
          configs.push({
            bow_type: bowType,
            distance,
            format,
            participant_count: count
          })
        }
      })
    })
  })
  return configs
}


const submitForm = async () => {
  if (!formData.value.season) {
    errorMessage.value = '请选择赛季'
    return
  }

  const configurations = buildConfigurations()
  
  if (configurations.length === 0) {
    errorMessage.value = '请填写至少一个赛事配置（参赛人数 > 0）'
    return
  }

  loading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const payload = {
      year: formData.value.year,
      season: formData.value.season,
      configurations
    }
    const response = await eventAPI.createWithConfigs(payload)
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
.bow-config-group {
  margin-bottom: 30px;

  .bow-type-title {
    font-size: 15px;
    font-weight: 600;
    color: #667eea;
    margin: 15px 0 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #667eea;
  }
}

.table-wrapper {
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
}

.config-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 400px;

  th, td {
    border: 1px solid #e0e0e0;
    padding: 10px;
    text-align: center;
  }

  th {
    background: #f5f5f5;
    font-weight: 600;
    color: #333;
    padding: 12px 10px;
  }

  td {
    background: white;

    &.format-label {
      font-weight: 500;
      color: #666;
      text-align: left;
      background: #f9f9f9;
    }

    &:first-child {
      border-left: 1px solid #e0e0e0;
    }
  }

  tbody tr:nth-child(even) {
    background: #fafafa;

    .format-label {
      background: #f3f3f3;
    }
  }
}

.input-cell {
  padding: 6px;
}

.table-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
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
</style>
