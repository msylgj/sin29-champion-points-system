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
      <div v-if="dictionaryLoadFailed || existingConfigLoadFailed || existingRegistrationLoadFailed" class="page-feedback-list">
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
        <div v-if="existingRegistrationLoadFailed" class="failure-notice">
          <div>
            <strong>历史报名加载失败</strong>
            <p>当前未能获取同年度同赛季的已有报名，可重新尝试加载。</p>
          </div>
          <button type="button" class="btn-retry-inline" @click="loadExistingRegistrations">重试加载报名</button>
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

      <div class="section">
        <h2 class="section-title">导入报名表</h2>
        <p class="section-help">支持 Excel 导入报名数据，字段包括姓名、俱乐部、距离、比赛弓种、积分弓种、分组。</p>

        <div class="upload-area">
          <input
            type="file"
            ref="registrationFileInput"
            @change="onRegistrationFileSelected"
            accept=".xlsx,.xls"
            hidden
          />
          <button type="button" @click="registrationFileInput?.click()" class="btn-upload">
            选择 Excel 文件
          </button>
          <p class="upload-help">
              支持格式：Excel (.xlsx, .xls)<br/>
              <strong>列标题需包括：</strong><br/>
              <span style="color: #667eea;">姓名</span>、<span style="color: #667eea;">俱乐部</span>、<span style="color: #667eea;">距离</span>、<span style="color: #667eea;">比赛弓种</span>、<span style="color: #667eea;">积分弓种</span>、<span style="color: #667eea;">分组</span><br/>
              <em style="font-size: 12px; color: #999;">弓种、距离、分组的值支持使用字典名称；导入时会按字典名称做模糊匹配，例如"传统"匹配"传统弓"、"男子"匹配"男子组"，距离支持"10"、"10m"、"18"、"18m"等写法</em><br/>
              <em>当比赛弓种为“无瞄弓”时，积分弓种仅支持：光弓、美猎弓、传统弓，否则与比赛弓种相同。</em><br/>
              <strong>弓种枚举：</strong>{{ bowTypeEnumText }}<br/>
              <strong>距离枚举：</strong>{{ distanceEnumText }}<br/>
              <strong>分组枚举：</strong>{{ genderGroupEnumText }}<br/>
              系统会自动识别列标题并匹配字段
          </p>
          
        </div>

        <div v-if="registrationUploadedFileName" class="file-info">
          已选择：{{ registrationUploadedFileName }}
        </div>

        <div v-if="registrationBatch.length > 0" class="scores-preview">
          <h3>待导入报名 ({{ registrationBatch.length }}条，合法 {{ validRegistrationCount }} / 异常 {{ invalidRegistrationCount }})</h3>
          <table class="preview-table">
            <thead>
              <tr>
                <th>姓名</th>
                <th>俱乐部</th>
                <th>距离</th>
                <th>比赛弓种</th>
                <th>积分弓种</th>
                <th>分组</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="(registration, index) in registrationBatch"
                :key="index"
                :class="{ 'row-error': !registration.__valid, 'row-duplicate': registration.__valid && (registration.__duplicate_with_existing || registration.__duplicate_in_file_to_remove) }"
              >
                <td>{{ registration.name }}</td>
                <td>{{ registration.club || '-' }}</td>
                <td>{{ getDistanceLabel(registration.distance) }}</td>
                <td>{{ getBowTypeLabel(registration.competition_bow_type) }}</td>
                <td>{{ getBowTypeLabel(registration.points_bow_type) }}</td>
                <td>{{ getGenderGroupLabel(registration.competition_gender_group) }}</td>
                <td>
                  <span v-if="registration.__valid && registration.__duplicate_in_file_to_remove" class="status-tag status-duplicate" title="Excel 中存在重复行，导入时该行将被移除">重复（将移除）</span>
                  <span v-else-if="registration.__valid && registration.__duplicate_with_existing" class="status-tag status-duplicate" title="与已有报名重复，导入时将覆盖原记录">重复（将覆盖）</span>
                  <span v-else-if="registration.__valid" class="status-tag status-ok">通过</span>
                  <span v-else class="status-tag status-error" :title="registration.__errors.join('；')">异常</span>
                </td>
                <td>
                  <button type="button" @click="removeRegistrationBatchItem(index)" class="btn-remove-small">
                    删除
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="registrationParseMsg.successMsg.value || registrationParseMsg.errorMsg.value" class="import-feedback">
          <div v-if="registrationParseMsg.successMsg.value" class="import-message import-message-success">
            {{ registrationParseMsg.successMsg.value }}
          </div>
          <div v-if="registrationParseMsg.errorMsg.value" class="import-message import-message-error">
            {{ registrationParseMsg.errorMsg.value }}
          </div>
        </div>

        <div class="import-actions" v-if="registrationBatch.length > 0">
          <button
            type="button"
            @click="submitRegistrationImport"
            class="btn-submit"
            :disabled="registrationImportLoading || invalidRegistrationCount > 0"
          >
            {{ registrationImportLoading ? '导入中...' : `确认导入报名 (${validRegistrationCount}条)` }}
          </button>
        </div>
      </div>

      <!-- 赛事配置 -->
      <div class="section">
        <h2 class="section-title">赛事配置</h2>
        <p class="section-help">每个弓种一张表。个人赛按距离和性别分组填写；混双、团体按距离填写。</p>

        <div class="bow-config-grid">
          <template v-for="bowType in bowTypes" :key="bowType.code">
            <div v-if="hasBowTypeDistances(bowType.code)" class="bow-config-group">
              <h3 class="bow-type-title">{{ bowType.name }}</h3>

              <div class="table-wrapper">
                <table class="config-table">
                  <thead>
                    <tr>
                      <th rowspan="2">类型</th>
                      <th
                        v-for="distance in getBowTypeDistances(bowType.code)"
                        :key="distance.code"
                        :colspan="competitionGenderGroups.length"
                        class="distance-header"
                      >
                        {{ distance.name }}
                        <br>
                        <small class="group-tag">{{ getGroupCode(bowType.code, distance.code) }}</small>
                      </th>
                    </tr>
                    <tr>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-gender-group-row`">
                        <th
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}`"
                          class="gender-header"
                        >
                          {{ genderGroup.name }}
                        </th>
                      </template>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td class="format-label">{{ countRows[0].label }}</td>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-individual-group-row`">
                        <td
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}-individual`"
                          class="readonly-cell"
                        >
                          {{ getIndividualCount(genderGroup.code, bowType.code, distance.code) }}
                        </td>
                      </template>
                    </tr>
                    <tr>
                      <td class="format-label">{{ countRows[1].label }}</td>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-team-row`">
                        <td
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}-team`"
                          class="input-cell shared-cell"
                        >
                          <input
                            v-model.number="configTable[genderGroup.code][bowType.code][distance.code].team_count"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="off"
                            class="table-input"
                            placeholder="0"
                          />
                        </td>
                      </template>
                    </tr>
                    <tr>
                      <td class="format-label">{{ countRows[2].label }}</td>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-mixed-row`">
                        <td
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}-mixed`"
                          :class="genderGroup.code === sharedGenderGroupCode ? 'input-cell shared-cell' : 'unavailable-cell'"
                        >
                          <input
                            v-if="genderGroup.code === sharedGenderGroupCode"
                            v-model.number="configTable[sharedGenderGroupCode][bowType.code][distance.code].mixed_doubles_team_count"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="off"
                            class="table-input"
                            placeholder="0"
                          />
                          <template v-else>-</template>
                        </td>
                      </template>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </template>
        </div>
      </div>

      <EventRegistrationManagePanel
        :registrations="existingRegistrations"
        :loading="existingRegistrationsLoading"
        :bow-types="bowTypes"
        :distances="distances"
        :competition-gender-groups="competitionGenderGroups"
        @changed="handleRegistrationsChanged"
      />

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
import { computed, ref, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, eventConfigAPI, eventRegistrationAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useEventConfigGrid } from '@/composables/useEventConfigGrid'
import { useMessage } from '@/composables/useMessage'
import {
  buildRegistrationUniqueKey,
  parseRegistrationImportData,
  recalculateRegistrationDuplicateFlags,
} from '@/utils/registrationImportParsing'
import EventRegistrationManagePanel from './EventRegistrationManagePanel.vue'

const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const existingEventId = ref(null)
const formMsg = useMessage(5000)
const dictionaryLoadFailed = ref(false)
const existingConfigLoadFailed = ref(false)
const existingRegistrationLoadFailed = ref(false)
const sharedGenderGroupCode = 'mixed'
const registrationParseMsg = useMessage()
const registrationImportLoading = ref(false)
const registrationBatch = ref([])
const existingRegistrations = ref([])
const existingRegistrationsLoading = ref(false)
const registrationUploadedFileName = ref('')
const registrationFileInput = ref(null)

// 字典数据
const {
  bowTypes,
  distances,
  competitionGenderGroups,
  competitionGroups,
  loadDictionaries: fetchDictionaries
} = useDictionaries()

const formData = ref({
  year: currentYear,
  season: ''
})
const bowTypeEnumText = computed(() => bowTypes.value.map(item => `${item.name}`).join('、'))
const distanceEnumText = computed(() => distances.value.map(item => `${item.name}`).join('、'))
const genderGroupEnumText = computed(() => competitionGenderGroups.value.map(item => `${item.name}`).join('、'))

// 配置表数据结构：gender_group => bow_type => distance => count
const configTable = ref({})
const {
  countRows,
  getBowTypeDistances,
  hasBowTypeDistances,
  getGroupCode,
} = useEventConfigGrid(distances, competitionGroups)

// 初始化配置表
const initConfigTable = () => {
  configTable.value = {}
  if (competitionGenderGroups.value.length && bowTypes.value.length && distances.value.length) {
    competitionGenderGroups.value.forEach(genderGroup => {
      configTable.value[genderGroup.code] = {}
      bowTypes.value.forEach(bow => {
        configTable.value[genderGroup.code][bow.code] = {}
        distances.value.forEach(distance => {
          configTable.value[genderGroup.code][bow.code][distance.code] = {
            individual_participant_count: 0,
            mixed_doubles_team_count: 0,
            team_count: 0
          }
        })
      })
    })
  }
}

const applyConfigurationsToTable = (configurations = []) => {
  initConfigTable()
  configurations.forEach(config => {
    const genderGroup = config.gender_group || sharedGenderGroupCode
    const genderGroupMap = configTable.value[genderGroup]
    const bowTypeMap = genderGroupMap?.[config.bow_type]
    const distanceMap = bowTypeMap?.[config.distance]
    if (!distanceMap) return

    distanceMap.individual_participant_count = Number(config.individual_participant_count || 0)
    distanceMap.team_count = Number(config.team_count || 0)

    const sharedDistanceMap = configTable.value[sharedGenderGroupCode]?.[config.bow_type]?.[config.distance]
    if (sharedDistanceMap) {
      sharedDistanceMap.mixed_doubles_team_count += Number(config.mixed_doubles_team_count || 0)
    }
  })

  applyRegistrationCountsToTable(existingRegistrations.value)
}

const applyRegistrationCountsToTable = (registrations = []) => {
  if (!competitionGenderGroups.value.length || !bowTypes.value.length || !distances.value.length) {
    return
  }

  if (Object.keys(configTable.value).length === 0) {
    initConfigTable()
  }

  competitionGenderGroups.value.forEach(genderGroup => {
    bowTypes.value.forEach(bow => {
      distances.value.forEach(distance => {
        const counts = configTable.value[genderGroup.code]?.[bow.code]?.[distance.code]
        if (counts) {
          counts.individual_participant_count = 0
        }
      })
    })
  })

  ;(registrations || []).forEach(item => {
    const genderGroup = item.competition_gender_group || sharedGenderGroupCode
    const counts = configTable.value[genderGroup]?.[item.competition_bow_type]?.[item.distance]
    if (!counts) return
    counts.individual_participant_count += 1
  })
}

const getIndividualCount = (genderGroupCode, bowTypeCode, distanceCode) => {
  return Number(
    configTable.value[genderGroupCode]?.[bowTypeCode]?.[distanceCode]?.individual_participant_count || 0
  )
}

const loadExistingRegistrations = async () => {
  if (!formData.value.season) {
    existingRegistrations.value = []
    existingRegistrationLoadFailed.value = false
    existingRegistrationsLoading.value = false
    applyRegistrationCountsToTable([])
    return
  }

  existingRegistrationsLoading.value = true
  try {
    const response = await eventRegistrationAPI.getList({
      page: 1,
      page_size: 1000,
      year: formData.value.year,
      season: formData.value.season,
    })
    existingRegistrations.value = response.items || []
    existingRegistrationLoadFailed.value = false
    applyRegistrationCountsToTable(existingRegistrations.value)
  } catch (error) {
    console.error('加载已存在报名失败:', error)
    existingRegistrationLoadFailed.value = true
    existingRegistrations.value = []
    applyRegistrationCountsToTable([])
  } finally {
    existingRegistrationsLoading.value = false
  }
}

const loadExistingEventConfigurations = async () => {
  if (!formData.value.season || !competitionGenderGroups.value.length || !bowTypes.value.length || !distances.value.length) {
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
      applyRegistrationCountsToTable(existingRegistrations.value)
    }
    existingConfigLoadFailed.value = false
  } catch (error) {
    existingEventId.value = null
    console.error('加载已存在赛事配置失败:', error)
    existingConfigLoadFailed.value = true
    formMsg.show('error', '加载历史赛事配置失败，请重试')
    initConfigTable()
    applyRegistrationCountsToTable(existingRegistrations.value)
  }
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    await fetchDictionaries()
    initConfigTable()
    applyRegistrationCountsToTable(existingRegistrations.value)
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
  () => [
    formData.value.year,
    formData.value.season,
    competitionGenderGroups.value.length,
    bowTypes.value.length,
    distances.value.length
  ],
  () => {
    loadExistingEventConfigurations()
    loadExistingRegistrations()
  }
)

watch(
  () => [formData.value.year, formData.value.season],
  () => {
    registrationBatch.value = []
    registrationUploadedFileName.value = ''
    registrationParseMsg.clear()
    if (registrationFileInput.value) {
      registrationFileInput.value.value = ''
    }
  }
)

// 将表格数据转换为配置数组
const buildConfigurations = () => {
  const configs = []
  bowTypes.value.forEach(bowType => {
    getBowTypeDistances(bowType.code).forEach(distance => {
      competitionGenderGroups.value.forEach(genderGroup => {
        const counts = configTable.value[genderGroup.code]?.[bowType.code]?.[distance.code]
        if (!counts) return

        const individual = Number(counts.individual_participant_count || 0)
        const team = Number(counts.team_count || 0)
        const mixed = genderGroup.code === sharedGenderGroupCode
          ? Number(configTable.value[sharedGenderGroupCode]?.[bowType.code]?.[distance.code]?.mixed_doubles_team_count || 0)
          : 0

        if (individual > 0 || mixed > 0 || team > 0) {
          configs.push({
            gender_group: genderGroup.code,
            bow_type: bowType.code,
            distance: distance.code,
            individual_participant_count: individual,
            mixed_doubles_team_count: mixed,
            team_count: team
          })
        }
      })
    })
  })
  return configs
}

const syncExistingEventConfigurations = async (eventId, configurations) => {
  const detail = await eventAPI.getDetail(eventId)
  const existingConfigs = detail.configurations || []

  const existingMap = new Map(
    existingConfigs.map(item => [`${item.gender_group}|${item.bow_type}|${item.distance}`, item])
  )
  const newMap = new Map(
    configurations.map(item => [`${item.gender_group}|${item.bow_type}|${item.distance}`, item])
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
          gender_group: config.gender_group,
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

const getBowTypeLabel = (type) => {
  const found = bowTypes.value.find(item => item.code === type)
  return found ? found.name : type || '-'
}

const getDistanceLabel = (distance) => {
  const found = distances.value.find(item => item.code === distance)
  return found ? found.name : distance || '-'
}

const getGenderGroupLabel = (groupCode) => {
  const found = competitionGenderGroups.value.find(item => item.code === groupCode)
  return found ? found.name : groupCode || '-'
}

const validRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid).length)
const invalidRegistrationCount = computed(() => registrationBatch.value.filter(item => !item.__valid).length)
const duplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate).length)
const inFileDuplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_in_file).length)
const inFileDuplicateRegistrationToRemoveCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length)
const existingDuplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_with_existing).length)

const parseRegistrationExcelData = (jsonData) => {
  registrationParseMsg.clear()

  const result = parseRegistrationImportData({
    jsonData,
    bowTypes: bowTypes.value,
    distances: distances.value,
    competitionGenderGroups: competitionGenderGroups.value,
    existingRegistrations: existingRegistrations.value,
    selectedYear: formData.value.year,
    selectedSeason: formData.value.season,
  })

  if (result.errorMessage) {
    registrationParseMsg.errorMsg.value = result.errorMessage
    return
  }

  registrationBatch.value = result.registrations
  registrationParseMsg.successMsg.value = result.successMessage
}

const onRegistrationFileSelected = async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  registrationUploadedFileName.value = file.name
  registrationParseMsg.clear()

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!isExcel) {
    registrationParseMsg.errorMsg.value = '请上传 .xlsx 或 .xls 格式的文件'
    return
  }

  const reader = new FileReader()
  reader.onerror = () => {
    registrationParseMsg.errorMsg.value = '文件读取失败，请重试'
  }

  if (isExcel) {
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx')
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        parseRegistrationExcelData(jsonData)
      } catch (error) {
        registrationParseMsg.errorMsg.value = 'Excel 文件解析失败：' + error.message
      }
    }
    reader.readAsArrayBuffer(file)
    return
  }
}

const removeRegistrationBatchItem = (index) => {
  registrationBatch.value = recalculateRegistrationDuplicateFlags(
    registrationBatch.value.filter((_, itemIndex) => itemIndex !== index),
    existingRegistrations.value
  )
}

const submitRegistrationImport = async () => {
  if (!formData.value.season) {
    formMsg.show('error', '请先选择赛季')
    return
  }

  if (registrationBatch.value.length === 0) {
    registrationParseMsg.errorMsg.value = '请先上传并解析报名文件'
    return
  }

  if (invalidRegistrationCount.value > 0) {
    registrationParseMsg.errorMsg.value = `当前有 ${invalidRegistrationCount.value} 条异常数据，请删除或修正后再导入。`
    return
  }

  registrationImportLoading.value = true
  registrationParseMsg.clear()

  try {
    const validRegistrations = registrationBatch.value
      .filter(item => item.__valid && !item.__duplicate_in_file_to_remove)
      .map(item => ({
        year: item.year,
        season: item.season,
        name: item.name,
        club: item.club,
        distance: item.distance,
        competition_bow_type: item.competition_bow_type,
        points_bow_type: item.points_bow_type,
        competition_gender_group: item.competition_gender_group,
      }))

    const dedupedRegistrationMap = new Map()
    validRegistrations.forEach(item => {
      dedupedRegistrationMap.set(buildRegistrationUniqueKey(item), item)
    })
    const submittedRegistrations = Array.from(dedupedRegistrationMap.values())

    await eventRegistrationAPI.batchImport({ registrations: submittedRegistrations })

    if (duplicateRegistrationCount.value > 0) {
      formMsg.show(
        'success',
        `成功导入 ${submittedRegistrations.length} 条报名（原始合法 ${validRegistrationCount.value} 条）；其中与已有报名重复 ${existingDuplicateRegistrationCount.value} 条（覆盖更新），文件内重复 ${inFileDuplicateRegistrationCount.value} 条（已移除 ${inFileDuplicateRegistrationToRemoveCount.value} 条）`
      )
    } else {
      formMsg.show('success', `成功导入 ${submittedRegistrations.length} 条报名`)
    }

    registrationBatch.value = []
    registrationUploadedFileName.value = ''
    if (registrationFileInput.value) {
      registrationFileInput.value.value = ''
    }
    await handleRegistrationsChanged()
  } catch (error) {
    let errorMsg = error?.detail || error?.message || '报名导入失败，请重试'

    if (Array.isArray(error?.detail)) {
      errorMsg = error.detail.map(item => item.msg || '验证失败').join('；')
    }

    formMsg.show('error', errorMsg)
    console.error('Error importing registrations:', error)
  } finally {
    registrationImportLoading.value = false
  }
}

const handleRegistrationsChanged = async () => {
  await loadExistingRegistrations()
  await loadExistingEventConfigurations()
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
