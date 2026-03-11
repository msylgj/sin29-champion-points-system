<template>
  <div class="event-add-page safe-area">
    <div class="page-header">
      <div class="header-top">
        <button class="btn-back" @click="$router.push('/score-import')" title="返回导入成绩">
          ← 返回
        </button>
        <div class="header-title-wrap">
          <h1>赛事配置</h1>
          <p class="subtitle">按年度和赛季配置参赛信息</p>
        </div>
        <span class="header-spacer" aria-hidden="true"></span>
      </div>
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
            <option value="春季赛">春季赛（1-3月）</option>
            <option value="夏季赛">夏季赛（4-6月）</option>
            <option value="秋季赛">秋季赛（7-9月）</option>
            <option value="冬季赛">冬季赛（10-12月）</option>
          </select>
          <small class="help-text">选择赛事所属的季度</small>
          <small v-if="existingEventId" class="help-text">检测到该赛事已存在，已自动带入历史配置，保存后将更新该赛事配置</small>
        </div>
      </div>

      <!-- 赛事配置 -->
      <div class="section">
        <h2 class="section-title">赛事配置</h2>
        <p class="section-help">按弓种+距离填写组别及人数：个人（排位/淘汰共用）、混双队伍、团体队伍</p>

        <!-- 为每种弓创建一个表格 -->
        <div v-for="bowType in bowTypes" :key="bowType.code" class="bow-config-group">
          <h3 class="bow-type-title">{{ bowType.name }}</h3>
          
          <div class="table-wrapper">
            <table class="config-table">
              <thead>
                <tr>
                  <th>人数类型</th>
                  <th v-for="distance in sortedDistances" :key="distance.code" v-show="shouldShowDistance(distance.code)">
                    {{ distance.name }}
                    <br>
                    <small class="group-tag">{{ getGroupCode(bowType.code, distance.code) }}</small>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="row in countRows" :key="row.key">
                  <td class="format-label">{{ row.label }}</td>
                  <td v-for="distance in sortedDistances" :key="distance.code" v-show="shouldShowDistance(distance.code)" class="input-cell" :class="{ 'disabled-cell': isInputDisabled(bowType.code, distance.code) }">
                    <input 
                      v-model.number="configTable[bowType.code][distance.code][row.key]"
                      type="number"
                      min="0"
                      max="999"
                      class="table-input"
                      :placeholder="`0`"
                      :disabled="isInputDisabled(bowType.code, distance.code)"
                      :title="isInputDisabled(bowType.code, distance.code) ? '该组别未配置' : ''"
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
          {{ loading ? (existingEventId ? '更新中...' : '保存中...') : (existingEventId ? '更新配置' : '保存赛事') }}
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
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, dictionaryAPI, eventConfigAPI } from '@/api'

const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const existingEventId = ref(null)

// 字典数据
const bowTypes = ref([])
const distances = ref([])
const competitionGroups = ref([])

const formData = ref({
  year: currentYear,
  season: ''
})

const sortedDistances = computed(() => {
  return [...distances.value].sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10))
})

// 配置表数据结构：bow_type => format => distance => count
const configTable = ref({})
const countRows = [
  { key: 'individual_participant_count', label: '个人（排位/淘汰）' },
  { key: 'mixed_doubles_team_count', label: '混双（队伍）' },
  { key: 'team_count', label: '团体（队伍）' }
]

const getGroupCode = (bowType, distance) => {
  const found = competitionGroups.value.find(
    item => item.bow_type === bowType && item.distance === distance
  )
  return found ? `${found.group_code}组` : '-'
}

// 检查是否应该显示该距离列
const shouldShowDistance = (distance) => {
  return competitionGroups.value.some(
    item => item.distance === distance
  )
}

// 检查是否应该禁用该输入框
const isInputDisabled = (bowType, distance) => {
  return !competitionGroups.value.some(
    item => item.bow_type === bowType && item.distance === distance
  )
}

// 初始化配置表
const initConfigTable = () => {
  configTable.value = {}
  if (bowTypes.value.length && distances.value.length) {
    bowTypes.value.forEach(bow => {
      configTable.value[bow.code] = {}
      distances.value.forEach(distance => {
        configTable.value[bow.code][distance.code] = {
          individual_participant_count: 0,
          mixed_doubles_team_count: 0,
          team_count: 0
        }
      })
    })
  }
}

const applyConfigurationsToTable = (configurations = []) => {
  initConfigTable()
  configurations.forEach(config => {
    const bowTypeMap = configTable.value[config.bow_type]
    const distanceMap = bowTypeMap?.[config.distance]
    if (!distanceMap) return

    distanceMap.individual_participant_count = Number(config.individual_participant_count || 0)
    distanceMap.mixed_doubles_team_count = Number(config.mixed_doubles_team_count || 0)
    distanceMap.team_count = Number(config.team_count || 0)
  })
}

const loadExistingEventConfigurations = async () => {
  if (!formData.value.season || !bowTypes.value.length || !distances.value.length) {
    existingEventId.value = null
    initConfigTable()
    return
  }

  try {
    const response = await eventAPI.getList({
      page: 1,
      page_size: 1,
      year: formData.value.year,
      season: formData.value.season
    })

    const existingEvent = response.items?.[0]
    if (existingEvent) {
      existingEventId.value = existingEvent.id
      applyConfigurationsToTable(existingEvent.configurations || [])
    } else {
      existingEventId.value = null
      initConfigTable()
    }
  } catch (error) {
    existingEventId.value = null
    console.error('加载已存在赛事配置失败:', error)
    initConfigTable()
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    const response = await dictionaryAPI.getAll()
    if (response.success && response.data) {
      bowTypes.value = response.data.bowTypes || []
      distances.value = response.data.distances || []
      competitionGroups.value = response.data.competitionGroups || []
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

watch(
  () => [formData.value.year, formData.value.season, bowTypes.value.length, distances.value.length],
  () => {
    loadExistingEventConfigurations()
  }
)

// 将表格数据转换为配置数组
const buildConfigurations = () => {
  const configs = []
  Object.entries(configTable.value).forEach(([bowType, distanceMap]) => {
    Object.entries(distanceMap).forEach(([distance, counts]) => {
      const individual = Number(counts.individual_participant_count || 0)
      const mixed = Number(counts.mixed_doubles_team_count || 0)
      const team = Number(counts.team_count || 0)
      if (individual > 0 || mixed > 0 || team > 0) {
        configs.push({
          bow_type: bowType,
          distance,
          individual_participant_count: individual,
          mixed_doubles_team_count: mixed,
          team_count: team
        })
      }
    })
  })
  return configs
}

const syncExistingEventConfigurations = async (eventId, configurations) => {
  const detail = await eventAPI.getDetail(eventId)
  const existingConfigs = detail.configurations || []

  const existingMap = new Map(
    existingConfigs.map(item => [`${item.bow_type}|${item.distance}`, item])
  )
  const newMap = new Map(
    configurations.map(item => [`${item.bow_type}|${item.distance}`, item])
  )

  const updateOrCreateTasks = []

  newMap.forEach((config, key) => {
    const existing = existingMap.get(key)
    if (existing) {
      updateOrCreateTasks.push(
        eventConfigAPI.update(existing.id, {
          individual_participant_count: config.individual_participant_count,
          mixed_doubles_team_count: config.mixed_doubles_team_count,
          team_count: config.team_count
        })
      )
    } else {
      updateOrCreateTasks.push(
        eventConfigAPI.create({
          event_id: eventId,
          bow_type: config.bow_type,
          distance: config.distance,
          individual_participant_count: config.individual_participant_count,
          mixed_doubles_team_count: config.mixed_doubles_team_count,
          team_count: config.team_count
        })
      )
    }
  })

  const deleteTasks = []
  existingMap.forEach((existing, key) => {
    if (!newMap.has(key)) {
      deleteTasks.push(eventConfigAPI.delete(existing.id))
    }
  })

  await Promise.all([...updateOrCreateTasks, ...deleteTasks])
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

    if (existingEventId.value) {
      await syncExistingEventConfigurations(existingEventId.value, configurations)
      successMessage.value = '赛事配置更新成功'
    } else {
      await eventAPI.createWithConfigs(payload)
      successMessage.value = '赛事添加成功'
    }

    setTimeout(() => {
      router.push('/score-import')
    }, 1500)
  } catch (error) {
    errorMessage.value = error.message || (existingEventId.value ? '更新失败，请重试' : '添加失败，请重试')
    console.error('Error saving event config:', error)
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

  .header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }

  .header-title-wrap {
    flex: 1;
    text-align: center;
  }

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

  .btn-back {
    padding: 8px 12px;
    background: rgba(255, 255, 255, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.3);
    color: white;
    border-radius: 6px;
    font-size: 13px;
    cursor: pointer;
    transition: all 0.3s;
    white-space: nowrap;

    &:hover {
      background: rgba(255, 255, 255, 0.3);
      border-color: rgba(255, 255, 255, 0.5);
    }

    &:active {
      transform: scale(0.95);
    }
  }

  .header-spacer {
    width: 70px;
    height: 1px;
    flex-shrink: 0;
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

  &.disabled-cell {
    background-color: #f5f5f5;
    opacity: 0.6;
  }
}

.table-input {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  text-align: center;

  &:disabled {
    background-color: #f0f0f0;
    cursor: not-allowed;
    color: #999;
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
