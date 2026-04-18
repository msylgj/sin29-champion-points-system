<template>
  <div class="score-import-page safe-area">
    <div class="page-header">
      <div class="header-top">
        <button class="btn-back" @click="$router.push('/points-display')" title="返回积分排名">
          ← 返回
        </button>
        <div>
          <h1>导入成绩</h1>
          <p class="subtitle">为赛事导入参赛者成绩</p>
        </div>
        <button class="btn-add-event" @click="navigateToAddEvent" title="赛事配置">
          ➕ 赛事配置
        </button>
      </div>
    </div>

    <div class="import-container">
      <!-- 赛事选择 -->
      <div class="section">
        <h2 class="section-title">选择赛事</h2>
        
        <div v-if="events.length === 0" class="no-events-tip">
          <p>📋 当前无赛事记录，请先添加赛事</p>
          <button class="btn-add-event-inline" @click="navigateToAddEvent">
            ➕ 赛事配置
          </button>
        </div>

        <div v-else class="form-group">
          <label for="event-select">赛事 *</label>
          <select 
            id="event-select"
            v-model="selectedEventId" 
            class="form-input"
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

        <div class="import-section">
          <div class="upload-area">
            <input 
              type="file"
              ref="fileInput"
              @change="onFileSelected"
              accept=".xlsx,.xls"
              hidden
            />
            <button type="button" @click="$refs.fileInput.click()" class="btn-upload">
              选择 Excel 文件
            </button>
            <p class="upload-help">
              支持格式：Excel (.xlsx, .xls)<br/>
              <strong>列标题需包括：</strong><br/>
              <span style="color: #667eea;">姓名</span>、<span style="color: #667eea;">弓种</span>、<span style="color: #667eea;">距离</span>、<span style="color: #667eea;">赛制</span>、<span style="color: #667eea;">排名</span>，可选：<span style="color: #667eea;">分组</span><br/>
              <em style="font-size: 12px; color: #999;">弓种、距离、赛制的值支持使用字典名称；导入时会按字典名称做模糊匹配，例如"传统"匹配"传统弓"、"排位"匹配"排位赛"，距离支持"10"、"10m"、"18"、"18m"等写法</em><br/>
              <em style="font-size: 12px; color: #999;">分组列可选；不填时排位/淘汰赛自动从报名表匹配，团体/混双默认为混合组</em><br/>
              <em style="font-size: 12px; color: #999;">导入时会按姓名、距离、弓种匹配当前赛事报名表，未匹配到对应报名记录时会标记为异常</em><br/>
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
            <table class="preview-table">
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
                  v-for="(score, index) in batchScores"
                  :key="index"
                  :class="{ 'row-error': !score.__valid, 'row-duplicate': score.__valid && (score.__duplicate_with_existing || score.__duplicate_in_file_to_remove) }"
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
                    <span v-else-if="score.__valid" class="status-tag status-ok">通过</span>
                    <span v-else class="status-tag status-error" :title="score.__errors.join('；')">异常</span>
                  </td>
                  <td>
                    <button @click="removeBatchScore(index)" class="btn-remove-small">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
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
            @click="$router.push('/points-display')"
            class="btn-cancel"
          >
            取消
          </button>
          <button 
            type="button"
            @click="submitImport"
            v-if="batchScores.length > 0"
            class="btn-submit"
            :disabled="importLoading || invalidScoreCount > 0"
          >
            {{ importLoading ? '导入中...' : `确认导入 (${validScoreCount}条)` }}
          </button>
        </div>
      </div>

      <!-- 成绩管理 -->
      <ScoreManagePanel
        v-if="selectedEvent"
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
import { ref, onMounted, computed } from 'vue'
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

const router = useRouter()
const events = ref([])
const selectedEventId = ref('')
const selectedEvent = ref(null)
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
  try {
    await fetchDictionaries()
  } catch (error) {
    console.error('加载字典数据失败:', error)
  }
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
  try {
    const pageSize = 100
    let page = 1
    let total = 0
    const all = []

    do {
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
  } catch (error) {
    console.error('加载成绩管理数据失败:', error)
    pageMsg.show('error', '加载成绩失败')
    managedScores.value = []
  } finally {
    managedScoresLoading.value = false
  }
}

const loadEventRegistrations = async () => {
  if (!selectedEvent.value?.year || !selectedEvent.value?.season) {
    eventRegistrations.value = []
    return
  }

  try {
    const response = await eventRegistrationAPI.getList({
      page: 1,
      page_size: 1000,
      year: selectedEvent.value.year,
      season: selectedEvent.value.season
    })
    eventRegistrations.value = response.items || []
  } catch (error) {
    console.error('加载报名数据失败:', error)
    pageMsg.show('error', '加载报名数据失败')
    eventRegistrations.value = []
  }
}


// 赛事选择
const onEventSelected = async () => {
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
  const file = event.target.files[0]
  if (!file) return

  uploadedFileName.value = file.name
  parseMsg.clear()

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!isExcel) {
    parseMsg.errorMsg.value = '请上传 .xlsx 或 .xls 格式的文件'
    return
  }

  const reader = new FileReader()
  reader.onerror = () => {
    parseMsg.errorMsg.value = '文件读取失败，请重试'
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
        parseExcelData(jsonData)
      } catch (error) {
        parseMsg.errorMsg.value = 'Excel 文件解析失败：' + error.message
      }
    }
    reader.readAsArrayBuffer(file)
    return
  }
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
  batchScores.value = recalculateDuplicateFlags(
    batchScores.value.filter((_, itemIndex) => itemIndex !== index),
    managedScores.value
  )
}

// 提交导入
const submitImport = async () => {
  if (batchScores.value.length === 0) {
    parseMsg.errorMsg.value = '请先上传并解析成绩文件'
    return
  }

  if (invalidScoreCount.value > 0) {
    parseMsg.errorMsg.value = `当前有 ${invalidScoreCount.value} 条异常数据，请删除或修正后再导入。`
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

    // 导入成功后保持在当前页，并刷新当前赛事成绩管理区
    await loadManagedScores()
  } catch (error) {
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

// 导航到添加赛事页面
const navigateToAddEvent = () => {
  router.push('/event-add')
}

onMounted(() => {
  pageMsg.clear()
  parseMsg.clear()
  submitMsg.clear()
  loadDictionaries()
  loadEvents()
})
</script>


<style scoped lang="scss" src="@/styles/ScoreImport.scss" />
