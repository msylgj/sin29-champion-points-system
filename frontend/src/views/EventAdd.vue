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
      <div v-if="dictionaryLoadFailed || existingConfigLoadFailed" class="page-feedback-list">
        <div v-if="dictionaryLoadFailed" class="failure-notice">
          <div>
            <strong>表单字典加载失败</strong>
            <p>赛事配置依赖弓种、距离和组别字典，请重试加载表单数据。</p>
          </div>
          <button type="button" class="btn-retry-inline" @click="loadDictionaries">重试加载</button>
        </div>
        <div v-if="existingConfigLoadFailed" class="failure-notice">
          <div>
            <strong>历史配置加载失败</strong>
            <p>当前未能获取同年度同赛季的已有配置，你可以重新尝试加载。</p>
          </div>
          <button type="button" class="btn-retry-inline" @click="loadExistingEventConfigurations">重试加载历史配置</button>
        </div>
      </div>

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
        </div>

        <div v-if="existingEventId" class="event-exist-feedback">
          <div class="import-message import-message-success">
            检测到该赛事已存在，已自动带入历史配置，保存后将更新该赛事配置
          </div>
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
    <div v-if="formMsg.successMsg.value" class="submit-floating-message submit-floating-success">
      {{ formMsg.successMsg.value }}
    </div>

    <!-- 错误提示 -->
    <div v-if="formMsg.errorMsg.value" class="error-message">
      {{ formMsg.errorMsg.value }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, eventConfigAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useEventConfigGrid } from '@/composables/useEventConfigGrid'
import { useMessage } from '@/composables/useMessage'

const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const existingEventId = ref(null)
const formMsg = useMessage(5000)
const dictionaryLoadFailed = ref(false)
const existingConfigLoadFailed = ref(false)

// 字典数据
const {
  bowTypes,
  distances,
  competitionGroups,
  loadDictionaries: fetchDictionaries
} = useDictionaries()

const formData = ref({
  year: currentYear,
  season: ''
})

// 配置表数据结构：bow_type => format => distance => count
const configTable = ref({})
const {
  countRows,
  sortedDistances,
  getGroupCode,
  shouldShowDistance,
  isInputDisabled
} = useEventConfigGrid(distances, competitionGroups)

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
    existingConfigLoadFailed.value = false
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
    existingConfigLoadFailed.value = false
  } catch (error) {
    existingEventId.value = null
    console.error('加载已存在赛事配置失败:', error)
    existingConfigLoadFailed.value = true
    formMsg.show('error', '加载历史赛事配置失败，请重试')
    initConfigTable()
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    await fetchDictionaries()
    initConfigTable()
    dictionaryLoadFailed.value = false
  } catch (error) {
    console.error('加载字典数据失败:', error)
    dictionaryLoadFailed.value = true
    formMsg.show('error', '加载表单数据失败，请重试')
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
    formMsg.show('error', '请选择赛季')
    return
  }

  const configurations = buildConfigurations()
  
  if (configurations.length === 0) {
    formMsg.show('error', '请填写至少一个赛事配置（参赛人数 > 0）')
    return
  }

  loading.value = true
  formMsg.clear()

  try {
    const payload = {
      year: formData.value.year,
      season: formData.value.season,
      configurations
    }

    if (existingEventId.value) {
      await syncExistingEventConfigurations(existingEventId.value, configurations)
      formMsg.show('success', '赛事配置更新成功')
    } else {
      await eventAPI.createWithConfigs(payload)
      formMsg.show('success', '赛事添加成功')
    }

    setTimeout(() => {
      router.push('/score-import')
    }, 1500)
  } catch (error) {
    formMsg.show('error', error.message || (existingEventId.value ? '更新失败，请重试' : '添加失败，请重试'))
    console.error('Error saving event config:', error)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss" src="@/styles/EventAdd.scss" />
