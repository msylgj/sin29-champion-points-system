<template>
  <div class="score-import-page safe-area" :class="{ 'wizard-mode': !!wizardEvent }">
    <div v-if="!wizardEvent" class="page-header">
      <div class="header-top">
        <button type="button" class="btn-back" :disabled="operationBusy" @click="returnToEventList" title="返回赛事清单">
          ← 返回
        </button>
        <div>
          <h1>导入成绩</h1>
          <p class="subtitle">为赛事导入参赛者成绩</p>
        </div>
        <button type="button" class="btn-add-event" data-test="score-complete" :disabled="operationBusy" @click="returnToEventList" title="完成并返回赛事清单">
          完成
        </button>
      </div>
    </div>

    <div class="import-container">
      <!-- 清单入口和向导锁定赛事；未绑定的旧入口保留赛事选择。 -->
      <div v-if="!wizardEvent" class="section">
        <h2 class="section-title">{{ isManagedEvent ? '当前赛事' : '选择赛事' }}</h2>
        
        <p v-if="isManagedEvent && managedEventLoading" role="status" data-test="managed-event-loading">正在读取指定赛事…</p>
        <div v-else-if="isManagedEvent && managedEventError" class="import-feedback" role="alert" data-test="managed-event-error">
          <p class="import-message import-message-error">{{ managedEventError }}</p>
          <button type="button" class="btn-add-event-inline" data-test="managed-event-retry" :disabled="operationBusy || managedEventLoading" @click="loadManagedEvent">重试加载当前赛事</button>
        </div>
        <p v-else-if="isManagedEvent && selectedEvent" class="section-help" data-test="managed-locked-event">当前赛事：{{ selectedEvent.year }} {{ selectedEvent.season }}（已锁定）</p>
        <div v-else-if="!isManagedEvent && events.length === 0" class="no-events-tip">
          <p>📋 当前无赛事记录，请返回赛事清单创建或选择赛事</p>
          <button type="button" class="btn-add-event-inline" @click="returnToEventList">返回赛事清单</button>
        </div>

        <div v-else-if="!isManagedEvent" class="form-group">
          <label for="event-select">赛事 *</label>
          <select 
            id="event-select"
            v-model="selectedEventId" 
            class="form-input"
            :disabled="operationBusy"
            @change="onEventSelected"
            required
          >
            <option value="">请选择赛事</option>
            <option v-for="event in events" :key="event.id" :value="event.id">
              {{ event.year }} {{ event.season }}
            </option>
          </select>
        </div>

        <!-- 选中赛事的配置信息 -->
        <div v-if="selectedEvent" class="event-info">
          <div class="info-card">
            <button type="button" class="config-toggle" @click="showEventConfig = !showEventConfig">
              <span class="info-title">赛事配置</span>
              <span class="toggle-icon">{{ showEventConfig ? '收起 ▲' : '展开 ▼' }}</span>
            </button>
            <div v-if="showEventConfig">
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
                            >
                              {{ getConfigCount(genderGroup.code, bowType.code, distance.code, countRows[0].key) }}
                            </td>
                          </template>
                        </tr>
                        <tr>
                          <td class="format-label">{{ countRows[1].label }}</td>
                          <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-team-row`">
                            <td
                              v-for="genderGroup in competitionGenderGroups"
                              :key="`${distance.code}-${genderGroup.code}-team`"
                              class="shared-cell"
                            >
                              {{ getConfigCount(genderGroup.code, bowType.code, distance.code, countRows[1].key) }}
                            </td>
                          </template>
                        </tr>
                        <tr>
                          <td class="format-label">{{ countRows[2].label }}</td>
                          <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-mixed-row`">
                            <td
                              v-for="genderGroup in competitionGenderGroups"
                              :key="`${distance.code}-${genderGroup.code}-mixed`"
                              :class="genderGroup.code === 'mixed' ? 'shared-cell' : 'unavailable-cell'"
                            >
                              {{ genderGroup.code === 'mixed' ? getMixedDoublesCount(bowType.code, distance.code) : '-' }}
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
          </div>
        </div>
      </div>

      <!-- 导入成绩 -->
      <div class="section" v-if="selectedEvent">
        <h2 class="section-title">导入成绩</h2>
        <p v-if="wizardEvent" class="section-help" data-test="wizard-locked-event">当前赛事：{{ wizardEvent.year }} {{ wizardEvent.season }}（已锁定）</p>
        <div v-if="lockedEventMode" class="import-feedback">
          <p v-if="wizardLoading" role="status" class="import-message">正在完整加载报名、已有成绩和字典，请稍候…</p>
          <div v-if="wizardDataError" class="import-message import-message-error" role="alert">
            {{ wizardDataError }}
            <button type="button" :disabled="wizardBusy" :data-test="wizardEvent ? 'wizard-retry-data' : 'managed-retry-data'" @click="reloadLockedData">重试加载导入校验数据</button>
          </div>
        </div>

        <div class="import-section">
          <div class="upload-area">
            <input 
              type="file"
              ref="fileInput"
              @change="onFileSelected"
              accept=".xlsx,.xls"
              :disabled="operationBusy || (lockedEventMode && !lockedDataReady)"
              hidden
            />
            <button type="button" @click="$refs.fileInput.click()" class="btn-upload" :disabled="operationBusy || (lockedEventMode && !lockedDataReady)">
              选择 Excel 文件
            </button>
            <p class="upload-help">
              支持格式：Excel (.xlsx, .xls)<br/>
              <strong>列标题需包括：</strong><br/>
              <span style="color: #667eea;">姓名</span>、<span style="color: #667eea;">弓种</span>、<span style="color: #667eea;">距离</span>、<span style="color: #667eea;">赛制</span>、<span style="color: #667eea;">排名</span>，可选：<span style="color: #667eea;">分组</span><br/>
              <em style="font-size: 12px; color: #999;">弓种、距离、赛制的值支持使用字典名称；导入时会按字典名称做模糊匹配，例如"传统"匹配"传统弓"、"排位"匹配"排位赛"，距离支持"10"、"10m"、"18"、"18m"等写法</em><br/>
              <em style="font-size: 12px; color: #999;">分组列可选；不填时排位/淘汰赛自动从报名表匹配，团体赛默认使用混合组，混双赛统一按混合组处理</em><br/>
              <em style="font-size: 12px; color: #999;">导入时会按姓名、距离、弓种匹配个人赛报名记录，排位赛/淘汰赛未匹配到对应报名记录时会标记为异常</em><br/>
              <strong>弓种枚举：</strong>{{ bowTypeEnumText }}<br/>
              <strong>距离枚举：</strong>{{ distanceEnumText }}<br/>
              <strong>赛制枚举：</strong>{{ formatEnumText }}<br/>
              系统会自动识别列标题并匹配字段
            </p>
          </div>
          <div v-if="uploadedFileName" class="file-info">
            已选择：{{ uploadedFileName }}
          </div>

          <div v-if="batchScores.length > 0" class="scores-preview">
            <h3>待导入成绩 ({{ batchScores.length }}条，合法 {{ validScoreCount }} / 异常 {{ invalidScoreCount }})</h3>
            <div
              v-for="section in scorePreviewSections"
              :key="section.key"
              class="preview-section"
            >
              <div class="preview-section-header" :class="`preview-section-${section.key}`">
                <span>{{ section.title }}</span>
                <strong>{{ section.items.length }}</strong>
              </div>
              <div v-if="section.items.length === 0" class="preview-empty">
                {{ section.emptyText }}
              </div>
              <table v-else class="preview-table">
                <thead>
                  <tr>
                    <th>姓名</th>
                    <th>弓种</th>
                    <th>距离</th>
                    <th>赛制</th>
                    <th>分组</th>
                    <th>排名</th>
                    <th>状态</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="{ item: score, index } in section.items"
                    :key="`${section.key}-${index}`"
                    :class="{ 'row-error': !score.__valid, 'row-duplicate': isScorePreviewDuplicate(score) }"
                  >
                    <td>{{ score.name }}</td>
                    <td>{{ getBowTypeLabel(score.bow_type) }}</td>
                    <td>{{ getDistanceLabel(score.distance) }}</td>
                    <td>{{ getFormatLabel(score.format) }}</td>
                    <td>{{ getGenderGroupLabel(score.gender_group) }}</td>
                    <td>{{ score.rank }}</td>
                    <td>
                      <span v-if="score.__valid && score.__duplicate_in_file_to_remove" class="status-tag status-duplicate" title="Excel 中存在重复行，导入时该行将被移除">重复（将移除）</span>
                      <span v-else-if="score.__valid && score.__duplicate_with_existing" class="status-tag status-duplicate" title="与已有成绩重复，导入时将覆盖原记录">重复（将覆盖）</span>
                      <span v-else-if="score.__valid && score.__duplicate_in_file" class="status-tag status-duplicate" title="Excel 中存在重复行，导入时保留第一条">重复（保留）</span>
                      <span v-else-if="score.__valid" class="status-tag status-ok">通过</span>
                      <span v-else class="status-tag status-error" :title="score.__errors.join('；')">异常</span>
                    </td>
                    <td>
                      <button @click="removeBatchScore(index)" class="btn-remove-small" :disabled="operationBusy">
                        删除
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div v-if="parseMsg.successMsg.value || parseMsg.errorMsg.value" class="import-feedback">
          <div v-if="parseMsg.successMsg.value" class="import-message import-message-success">
            {{ parseMsg.successMsg.value }}
          </div>
          <div v-if="parseMsg.errorMsg.value" class="import-message import-message-error">
            {{ parseMsg.errorMsg.value }}
          </div>
        </div>

        <!-- 导入按钮 -->
        <div class="import-actions">
          <button 
            type="button"
            v-if="!wizardEvent"
            :disabled="operationBusy"
            @click="returnToEventList"
            class="btn-cancel"
          >
            取消
          </button>
          <button 
            type="button"
            @click="submitImport"
            v-if="batchScores.length > 0"
            class="btn-submit"
            :disabled="operationBusy || invalidScoreCount > 0 || (lockedEventMode && !lockedDataReady)"
          >
            {{ importLoading ? '导入中...' : `确认导入 (${validScoreCount}条)` }}
          </button>
        </div>
      </div>

      <div v-if="wizardEvent && selectedEvent" class="section">
        <p class="section-help">也可明确使用本场已保存的成绩继续。已选择文件或仍有待导草稿时，请先完成导入或清除文件。</p>
        <div class="import-actions">
          <button type="button" class="btn-submit" data-test="wizard-use-existing" :disabled="!canUseExistingScores" @click="useExistingScores">使用已保存成绩继续（{{ managedScores.length }}条）</button>
          <button v-if="uploadedFileName || batchScores.length" type="button" class="btn-cancel" data-test="wizard-clear-draft" :disabled="wizardBusy" @click="clearUpload">清除待导文件</button>
        </div>
      </div>
      <!-- 成绩管理 -->
      <ScoreManagePanel
        v-if="selectedEvent && !wizardEvent && (!isManagedEvent || lockedDataReady)"
        :scores="managedScores"
        :loading="managedScoresLoading"
        :bow-types="bowTypes"
        :distances="distances"
        :competition-formats="competitionFormats"
        :competition-gender-groups="competitionGenderGroups"
      />
    </div>

    <div v-if="submitMsg.successMsg.value" class="submit-floating-message submit-floating-success">
      {{ submitMsg.successMsg.value }}
    </div>
    <div v-if="submitMsg.errorMsg.value" class="submit-floating-message submit-floating-error">
      {{ submitMsg.errorMsg.value }}
    </div>

    <!-- 提示信息 -->
    <div v-if="pageMsg.successMsg.value" class="success-message">
      {{ pageMsg.successMsg.value }}
    </div>
    <div v-if="pageMsg.errorMsg.value" class="error-message">
      {{ pageMsg.errorMsg.value }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, eventRegistrationAPI, scoreAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useEventConfigGrid } from '@/composables/useEventConfigGrid'
import { useMessage } from '@/composables/useMessage'
import {
  buildScoreUniqueKey,
  parseScoreImportData,
  recalculateDuplicateFlags
} from '@/utils/scoreImportParsing'
import ScoreManagePanel from './ScoreManagePanel.vue'
import { getAllPages } from '@/utils/pagination'

const props = defineProps({
  wizardEvent: { type: Object, default: null },
  managedEventId: { type: [String, Number, Array], default: undefined },
})
const emit = defineEmits(['complete', 'busy-change'])
const router = useRouter()
const events = ref([])
const isManagedEvent = computed(() => !props.wizardEvent && props.managedEventId !== undefined)
const lockedEventMode = computed(() => !!props.wizardEvent || isManagedEvent.value)
const managedEventId = computed(() => {
  const value = props.managedEventId
  if (typeof value === 'number') return Number.isSafeInteger(value) && value > 0 ? value : null
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) ? id : null
})
const managedEventLoading = ref(false)
const managedEventError = ref('')
const selectedEventId = ref(props.wizardEvent?.id || '')
const selectedEvent = ref(props.wizardEvent ? { ...props.wizardEvent } : null)
const batchScores = ref([])
const importLoading = ref(false)
const pageMsg = useMessage()
const parseMsg = useMessage()
const submitMsg = useMessage(5000)
const uploadedFileName = ref('')
const fileInput = ref(null)
const showEventConfig = ref(false)

const managedScores = ref([])
const managedScoresLoading = ref(false)
const eventRegistrations = ref([])
const wizardCompleted = ref(false)
const parsingLoading = ref(false)
const registrationsLoading = ref(false)
const dictionariesLoading = ref(false)
const registrationsReady = ref(false)
const scoresReady = ref(false)
const dictionariesReady = ref(false)
const registrationsError = ref('')
const scoresError = ref('')
const dictionariesError = ref('')
let activeReader = null
let disposed = false
const operationBusy = computed(() => parsingLoading.value || importLoading.value)
const wizardLoading = computed(() => managedEventLoading.value || managedScoresLoading.value || registrationsLoading.value || dictionariesLoading.value)
const wizardBusy = computed(() => operationBusy.value || wizardLoading.value)
const wizardDataError = computed(() => [dictionariesError.value, registrationsError.value, scoresError.value].filter(Boolean).join('；'))
const lockedDataReady = computed(() => lockedEventMode.value && !wizardCompleted.value && !!selectedEventId.value &&
  (!isManagedEvent.value || (!managedEventError.value && selectedEvent.value?.id === managedEventId.value && selectedEventId.value === managedEventId.value)) &&
  !wizardLoading.value && !wizardDataError.value && registrationsReady.value && scoresReady.value && dictionariesReady.value)
const canUseExistingScores = computed(() => !!props.wizardEvent && lockedDataReady.value && !operationBusy.value && managedScores.value.length > 0 && !uploadedFileName.value && batchScores.value.length === 0)
watch(wizardBusy, busy => { if (props.wizardEvent && !disposed) emit('busy-change', busy) }, { immediate: true, flush: 'sync' })
onBeforeUnmount(() => { disposed = true; activeReader?.abort(); if (props.wizardEvent) emit('busy-change', false) })

// 字典数据
const {
  bowTypes,
  distances,
  competitionFormats,
  competitionGenderGroups,
  competitionGroups,
  loadDictionaries: fetchDictionaries
} = useDictionaries()

const { countRows, getBowTypeDistances, hasBowTypeDistances, getGroupCode } = useEventConfigGrid(
  distances,
  competitionGroups
)

const bowTypeEnumText = computed(() => bowTypes.value.map(item => `${item.name}`).join('、'))
const distanceEnumText = computed(() => distances.value.map(item => `${item.name}`).join('、'))
const formatEnumText = computed(() => competitionFormats.value.map(item => `${item.name}`).join('、'))
const validScoreCount = computed(() => batchScores.value.filter(item => item.__valid).length)
const invalidScoreCount = computed(() => batchScores.value.filter(item => !item.__valid).length)
const duplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate).length)
const inFileDuplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_in_file).length)
const inFileDuplicateToRemoveCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length)
const existingDuplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_with_existing).length)
const isScorePreviewDuplicate = (item) => {
  return Boolean(item?.__valid && (item.__duplicate || item.__duplicate_in_file || item.__duplicate_with_existing))
}
const scorePreviewSections = computed(() => {
  const indexedItems = batchScores.value.map((item, index) => ({ item, index }))
  return [
    {
      key: 'error',
      title: '异常记录',
      emptyText: '没有异常记录',
      items: indexedItems.filter(({ item }) => !item.__valid),
    },
    {
      key: 'duplicate',
      title: '重复记录',
      emptyText: '没有重复记录',
      items: indexedItems.filter(({ item }) => isScorePreviewDuplicate(item)),
    },
    {
      key: 'normal',
      title: '正常记录',
      emptyText: '没有正常记录',
      items: indexedItems.filter(({ item }) => item.__valid && !isScorePreviewDuplicate(item)),
    },
  ]
})

// 获取弓种标签
const getBowTypeLabel = (type) => {
  const found = bowTypes.value.find(item => item.code === type)
  return found ? found.name : type
}

// 获取赛制标签
const getFormatLabel = (format) => {
  const found = competitionFormats.value.find(item => item.code === format)
  return found ? found.name : format
}

// 获取距离标签
const getDistanceLabel = (distance) => {
  const found = distances.value.find(item => item.code === distance)
  return found ? found.name : distance
}

// 获取分组标签
const getGenderGroupLabel = (genderGroup) => {
  if (!genderGroup) return ''
  const found = competitionGenderGroups.value.find(item => item.code === genderGroup)
  return found ? found.name : genderGroup
}

const getConfigCount = (genderGroup, bowType, distance, key) => {
  const config = selectedEvent.value?.configurations?.find(
    item => (item.gender_group || 'mixed') === genderGroup && item.bow_type === bowType && item.distance === distance
  )
  if (!config) return '-'
  return config[key] ?? 0
}

const getMixedDoublesCount = (bowType, distance) => {
  const total = (selectedEvent.value?.configurations || []).reduce((sum, item) => {
    if (item.bow_type !== bowType || item.distance !== distance) return sum
    return sum + Number(item?.mixed_doubles_team_count || 0)
  }, 0)

  return total > 0 ? total : '-'
}


const getSeasonOrder = (season) => {
  const s = String(season || '').trim()
  const seasonMap = { '春': 1, '夏': 2, '秋': 3, '冬': 4 }
  for (const [k, v] of Object.entries(seasonMap)) {
    if (s.includes(k)) return v
  }
  return 0
}

const compareEventsByYearAndSeasonDesc = (left, right) => {
  const yearDiff = Number(right?.year || 0) - Number(left?.year || 0)
  if (yearDiff !== 0) return yearDiff

  const seasonDiff = getSeasonOrder(right?.season) - getSeasonOrder(left?.season)
  if (seasonDiff !== 0) return seasonDiff

  return Number(right?.id || 0) - Number(left?.id || 0)
}

const selectLatestEvent = async () => {
  if (!events.value.length) {
    selectedEventId.value = ''
    selectedEvent.value = null
    return
  }

  const latestEvent = [...events.value].sort(compareEventsByYearAndSeasonDesc)[0]
  if (!latestEvent) return

  selectedEventId.value = latestEvent.id
  await onEventSelected()
}

// 加载字典数据
const loadDictionaries = async () => {
  dictionariesLoading.value = true
  dictionariesReady.value = false
  dictionariesError.value = ''
  try {
    const data = await fetchDictionaries()
    if (disposed) return
    if (isManagedEvent.value && ['bowTypes', 'distances', 'competitionFormats', 'competitionGenderGroups', 'competitionGroups'].some(key => !Array.isArray(data[key]))) throw new Error('字典数据不完整')
    dictionariesReady.value = true
  } catch (error) {
    dictionariesError.value = '加载字典数据失败，请重试'
    console.error('加载字典数据失败:', error)
  } finally { dictionariesLoading.value = false }
}

// 加载赛事列表
const loadEvents = async () => {
  try {
    const pageSize = 100
    let page = 1
    let total = 0
    const all = []

    do {
      const response = await eventAPI.getList({ page, page_size: pageSize })
      const items = response.items || []
      total = Number(response.total || 0)
      all.push(...items)
      page += 1
    } while (all.length < total)

    events.value = all
    await selectLatestEvent()
    // 如果列表为空，显示友好提示
  } catch {
    events.value = []
    selectedEventId.value = ''
    selectedEvent.value = null
  }
}

const loadManagedScores = async () => {
  if (!selectedEventId.value) {
    managedScores.value = []
    return
  }

  managedScoresLoading.value = true
  scoresReady.value = false
  scoresError.value = ''
  try {
    const pageSize = 100
    let page = 1
    let total = 0
    const all = []

    if (lockedEventMode.value) {
      all.push(...await getAllPages(scoreAPI.getList, { event_id: selectedEventId.value }))
      if (disposed) return
      if (isManagedEvent.value && all.some(item => item.event_id !== selectedEventId.value)) throw new Error('已有成绩不属于当前赛事')
    } else do {
      const response = await scoreAPI.getList({
        page,
        page_size: pageSize,
        event_id: selectedEventId.value
      })
      const items = response.items || []
      total = Number(response.total || 0)
      all.push(...items)
      page += 1
    } while (all.length < total)

    const uniqById = new Map()
    all.forEach(item => {
      if (!item || item.id == null) return
      if (uniqById.has(item.id)) return
      uniqById.set(item.id, {
        id: item.id,
        event_id: item.event_id,
        name: item.name || '',
        bow_type: item.bow_type || '',
        distance: item.distance || '',
        format: item.format || '',
        gender_group: item.gender_group || null,
        rank: Number(item.rank || 0)
      })
    })
    managedScores.value = Array.from(uniqById.values())
    scoresReady.value = true
  } catch (error) {
    scoresError.value = '加载已有成绩失败，请重试'
    console.error('加载成绩管理数据失败:', error)
    pageMsg.show('error', '加载成绩失败')
    managedScores.value = []
  } finally {
    managedScoresLoading.value = false
  }
}

const loadEventRegistrations = async () => {
  registrationsReady.value = false
  registrationsError.value = ''
  if (!selectedEvent.value?.year || !selectedEvent.value?.season) {
    eventRegistrations.value = []
    registrationsError.value = '缺少赛事年度或赛季，无法加载报名数据'
    return
  }
  registrationsLoading.value = true
  try {
    const params = { year: selectedEvent.value.year, season: selectedEvent.value.season }
    if (lockedEventMode.value) {
      const records = await getAllPages(eventRegistrationAPI.getList, params)
      if (disposed) return
      if (isManagedEvent.value && records.some(item => item.year !== params.year || item.season !== params.season)) throw new Error('报名记录不属于当前赛事')
      eventRegistrations.value = records
    } else {
      const response = await eventRegistrationAPI.getList({ page: 1, page_size: 1000, ...params })
      eventRegistrations.value = response.items || []
    }
    registrationsReady.value = true
  } catch (error) {
    registrationsError.value = '加载报名数据失败，请重试'
    console.error('加载报名数据失败:', error)
    pageMsg.show('error', '加载报名数据失败')
    eventRegistrations.value = []
  } finally { registrationsLoading.value = false }
}

const loadWizardData = async () => {
  if (!props.wizardEvent || wizardBusy.value || disposed) return
  await Promise.all([loadDictionaries(), loadEventRegistrations(), loadManagedScores()])
}
// A managed URL never falls back to a list or a different event, even on 404.
const loadManagedEvent = async () => {
  if (!isManagedEvent.value || wizardBusy.value || disposed) return
  managedEventLoading.value = true
  managedEventError.value = ''
  pageMsg.clear()
  selectedEvent.value = null
  selectedEventId.value = ''
  managedScores.value = []
  eventRegistrations.value = []
  registrationsReady.value = false
  scoresReady.value = false
  dictionariesReady.value = false
  const id = managedEventId.value
  try {
    if (id === null) throw new Error('赛事编号无效，请从赛事清单重新进入')
    const detail = await eventAPI.getDetail(id)
    if (disposed) return
    if (detail?.id !== id || !Number.isSafeInteger(detail.year) || detail.year < 1 ||
        !['春季赛', '夏季赛', '秋季赛', '冬季赛'].includes(detail.season) || !Array.isArray(detail.configurations)) {
      throw new Error('返回赛事与指定赛事不一致或信息不完整，已禁止导入')
    }
    selectedEvent.value = detail
    selectedEventId.value = id
    showEventConfig.value = false
    await Promise.all([loadDictionaries(), loadEventRegistrations(), loadManagedScores()])
  } catch (error) {
    if (!disposed) managedEventError.value = typeof error?.detail === 'string' ? error.detail : error?.message || '加载指定赛事失败，请重试'
    selectedEvent.value = null
    selectedEventId.value = ''
  } finally { managedEventLoading.value = false }
}
const reloadLockedData = () => props.wizardEvent ? loadWizardData() : loadManagedEvent()

const clearUpload = () => {
  if (operationBusy.value) return
  batchScores.value = []
  uploadedFileName.value = ''
  parseMsg.clear()
  if (fileInput.value) fileInput.value.value = ''
}
const useExistingScores = () => {
  if (!canUseExistingScores.value || disposed) return
  wizardCompleted.value = true
  emit('complete')
}

// 赛事选择
const onEventSelected = async () => {
  if (isManagedEvent.value || operationBusy.value) return
  if (!selectedEventId.value) {
    selectedEvent.value = null
    showEventConfig.value = false
    managedScores.value = []
    return
  }

  try {
    const response = await eventAPI.getDetail(selectedEventId.value)
    selectedEvent.value = response
    showEventConfig.value = false
    await loadEventRegistrations()
    await loadManagedScores()
  } catch (error) {
    pageMsg.errorMsg.value = '加载赛事信息失败'
    console.error('Error loading event:', error)
  }
}

// 文件选择
const onFileSelected = async (event) => {
  if (operationBusy.value || (lockedEventMode.value && !lockedDataReady.value) || disposed) return
  const file = event.target.files[0]
  if (!file) return
  uploadedFileName.value = file.name
  batchScores.value = []
  parseMsg.clear()
  const isExcel = /\.xlsx?$/i.test(file.name)
  if (!isExcel) { parseMsg.errorMsg.value = '请上传 .xlsx 或 .xls 格式的文件'; return }
  parsingLoading.value = true
  try {
    const buffer = await new Promise((resolve, reject) => {
      activeReader = new FileReader()
      activeReader.onload = e => resolve(e.target.result)
      activeReader.onerror = () => reject(new Error('文件读取失败，请重试'))
      activeReader.onabort = () => reject(new Error('文件读取已取消'))
      activeReader.readAsArrayBuffer(file)
    })
    if (disposed) return
    const XLSX = await import('xlsx')
    if (disposed) return
    const workbook = XLSX.read(new Uint8Array(buffer), { type: 'array' })
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    parseExcelData(XLSX.utils.sheet_to_json(worksheet, { header: 1 }))
  } catch (error) {
    if (!disposed) parseMsg.errorMsg.value = 'Excel 文件解析失败：' + error.message
  } finally { activeReader = null; parsingLoading.value = false }
}

// 解析 Excel 数据
const parseExcelData = (jsonData) => {
  parseMsg.clear()

  const result = parseScoreImportData({
    jsonData,
    bowTypes: bowTypes.value,
    distances: distances.value,
    competitionFormats: competitionFormats.value,
    competitionGenderGroups: competitionGenderGroups.value,
    eventRegistrations: eventRegistrations.value,
    managedScores: managedScores.value,
    selectedEventId: selectedEventId.value
  })

  if (result.errorMessage) {
    parseMsg.errorMsg.value = result.errorMessage
    return
  }

  batchScores.value = result.scores
  parseMsg.successMsg.value = result.successMessage
}

const removeBatchScore = (index) => {
  if (operationBusy.value) return
  batchScores.value = recalculateDuplicateFlags(
    batchScores.value.filter((_, itemIndex) => itemIndex !== index),
    managedScores.value
  )
}

// 提交导入
const submitImport = async () => {
  if (operationBusy.value || disposed || (lockedEventMode.value && !lockedDataReady.value)) return
  if (batchScores.value.length === 0) {
    parseMsg.errorMsg.value = '请先上传并解析成绩文件'
    return
  }

  if (invalidScoreCount.value > 0) {
    parseMsg.errorMsg.value = `当前有 ${invalidScoreCount.value} 条异常数据，请删除或修正后再导入。`
    return
  }

  if (lockedEventMode.value && batchScores.value.some(item => item.event_id !== selectedEventId.value)) {
    parseMsg.errorMsg.value = '待导成绩与当前赛事不一致，请重新选择文件'
    return
  }
  parseMsg.clear()
  importLoading.value = true
  submitMsg.clear()
  let submittedScores = []

  try {
    const validScores = batchScores.value
      .filter(item => item.__valid && !item.__duplicate_in_file_to_remove)
      .map(item => ({
        event_id: item.event_id,
        name: item.name,
        bow_type: item.bow_type,
        distance: item.distance,
        format: item.format,
        gender_group: item.gender_group || null,
        rank: item.rank
      }))

    const dedupedScoresMap = new Map()
    validScores.forEach(item => {
      dedupedScoresMap.set(buildScoreUniqueKey(item), item)
    })
    submittedScores = Array.from(dedupedScoresMap.values())

    await scoreAPI.batchImport({ scores: submittedScores })
    if (disposed) return
    const duplicateCount = duplicateScoreCount.value
    const inFileDuplicateCount = inFileDuplicateScoreCount.value
    const inFileDuplicateToRemove = inFileDuplicateToRemoveCount.value
    const existingDuplicateCount = existingDuplicateScoreCount.value
    if (duplicateCount > 0) {
      submitMsg.show('success', `成功导入 ${submittedScores.length} 条成绩（原始合法 ${validScoreCount.value} 条）；其中与已有成绩重复 ${existingDuplicateCount} 条（覆盖更新），文件内重复 ${inFileDuplicateCount} 条（已移除 ${inFileDuplicateToRemove} 条）`)
    } else {
      submitMsg.show('success', `成功导入 ${submittedScores.length} 条成绩`)
    }
    
    batchScores.value = []
    uploadedFileName.value = ''
    if (fileInput.value) {
      fileInput.value.value = ''
    }

    if (props.wizardEvent) {
      if (!disposed) { wizardCompleted.value = true; emit('complete') }
      return
    }
    if (!disposed) {
      try { await router.push('/event-list') }
      catch { submitMsg.show('error', '成绩已保存，但返回赛事清单失败，请点击完成重试') }
    }
  } catch (error) {
    if (disposed) return
    let errorMsg = '导入失败，请重试'
    
    console.error('Import error:', error)
    
    try {
      if (error.detail) {
        // 后端请求体验证错误兜底，例如长度限制等前端未覆盖的约束
        if (Array.isArray(error.detail)) {
          const errorMap = {}
          
          error.detail.forEach(e => {
            const msg = e.msg || '验证失败'
            const loc = e.loc || []
            
            // 从错误消息中提取类型信息
            let translatedMsg = msg
            
            // 弓种错误转换
            if (msg.includes('弓种必须是')) {
              const validBows = bowTypes.value.map(b => b.name).join('、')
              translatedMsg = `弓种必须是：${validBows}`
            }
            
            // 赛制/比赛类型错误转换
            if (msg.includes('比赛类型必须是') || msg.includes('赛制必须是')) {
              const validFormats = competitionFormats.value.map(f => f.name).join('、')
              translatedMsg = `赛制必须是：${validFormats}`
            }
            
            // 距离错误转换
            if (msg.includes('距离必须是')) {
              const validDistances = distances.value.map(d => d.name).join('、')
              translatedMsg = `距离必须是：${validDistances}`
            }
            
            if (loc && loc.length >= 2 && loc[0] === 'body' && loc[1] === 'scores') {
              const scoreIndex = parseInt(loc[2])
              if (Number.isNaN(scoreIndex)) return
              const lineNo = scoreIndex + 1
              const scoreName = submittedScores[scoreIndex]?.name || '未知'
              
              if (!errorMap[lineNo]) {
                errorMap[lineNo] = []
              }
              errorMap[lineNo].push(`${translatedMsg}（姓名：${scoreName}）`)
            }
          })
          
          // 构建错误提示
          const errorLines = Object.keys(errorMap).sort((a, b) => parseInt(a) - parseInt(b))
          if (errorLines.length > 0) {
            errorMsg = errorLines.map(lineNo => {
              return `第 ${lineNo} 条成绩：${errorMap[lineNo].join('；')}`
            }).join('\n')
          }
        } else {
          errorMsg = error.detail
        }
      } else if (error.message) {
        errorMsg = error.message
      }
    } catch (parseError) {
      console.error('Error parsing error response:', parseError)
      errorMsg = '导入失败，详情请查看控制台'
    }
    
    submitMsg.show('error', errorMsg)
    console.error('Error importing scores:', error)
  } finally {
    importLoading.value = false
  }
}

const returnToEventList = () => {
  if (!operationBusy.value) router.push('/event-list')
}

onMounted(() => {
  pageMsg.clear()
  parseMsg.clear()
  submitMsg.clear()
  if (props.wizardEvent) loadWizardData()
  else if (isManagedEvent.value) loadManagedEvent()
  else { loadDictionaries(); loadEvents() }
})
</script>


<style scoped lang="scss" src="@/styles/ScoreImport.scss" />
<style scoped>
.score-import-page.wizard-mode { padding-bottom: 0; background: transparent; }
</style>
