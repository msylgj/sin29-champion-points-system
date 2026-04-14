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
                        <td v-for="distance in sortedDistances" :key="distance.code" v-show="shouldShowDistance(distance.code)">
                          {{ getConfigCount(bowType.code, distance.code, row.key) }}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
              accept=".csv,.xlsx,.xls"
              hidden
            />
            <button type="button" @click="$refs.fileInput.click()" class="btn-upload">
              选择 Excel 或 CSV 文件
            </button>
            <p class="upload-help">
              支持格式：Excel (.xlsx, .xls) 或 CSV<br/>
              <strong>列标题需包括（推荐英文或中文）：</strong><br/>
              <span style="color: #667eea;">姓名</span>、<span style="color: #667eea;">俱乐部</span>、<span style="color: #667eea;">弓种</span>、<span style="color: #667eea;">距离</span>、<span style="color: #667eea;">赛制</span>、<span style="color: #667eea;">排名</span><br/>
              <em style="font-size: 12px; color: #999;">弓种、距离、赛制的值支持使用字典名称（如"光弓"、"10米"、"排位赛"）或代码（如"barebow"、"10m"、"ranking"）</em><br/>
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
                  <th>俱乐部</th>
                  <th>弓种</th>
                  <th>距离</th>
                  <th>赛制</th>
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
                  <td>{{ score.club || '-' }}</td>
                  <td>{{ getBowTypeLabel(score.bow_type) }}</td>
                  <td>{{ score.distance }}</td>
                  <td>{{ getFormatLabel(score.format) }}</td>
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
import { eventAPI, scoreAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useEventConfigGrid } from '@/composables/useEventConfigGrid'
import { useMessage } from '@/composables/useMessage'
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

// 字典数据
const {
  bowTypes,
  distances,
  competitionFormats,
  competitionGroups,
  loadDictionaries: fetchDictionaries
} = useDictionaries()

const normalizeKeyPart = (value) => (value || '').toString().trim().toLowerCase()
const { countRows, sortedDistances, getGroupCode, shouldShowDistance } = useEventConfigGrid(
  distances,
  competitionGroups
)

const bowTypeEnumText = computed(() => bowTypes.value.map(item => `${item.name}(${item.code})`).join('、'))
const distanceEnumText = computed(() => distances.value.map(item => `${item.name}(${item.code})`).join('、'))
const formatEnumText = computed(() => competitionFormats.value.map(item => `${item.name}(${item.code})`).join('、'))
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

const getConfigCount = (bowType, distance, key) => {
  const config = selectedEvent.value?.configurations?.find(
    item => item.bow_type === bowType && item.distance === distance
  )
  if (!config) return '-'
  return config[key] ?? 0
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
    const response = await eventAPI.getList({ page: 1, page_size: 100 })
    events.value = response.items || []
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
        club: item.club || '',
        bow_type: item.bow_type || '',
        distance: item.distance || '',
        format: item.format || '',
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
  if (!isExcel && !file.name.endsWith('.csv')) {
    parseMsg.errorMsg.value = '请上传 .xlsx, .xls 或 .csv 格式的文件'
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

  // CSV 文件处理
  reader.onload = (e) => {
    try {
      const csv = e.target.result
      const lines = csv.split('\n')
      const jsonData = lines.map(line => line.split(',').map(p => p.trim()))
      parseExcelData(jsonData)
    } catch (error) {
      parseMsg.errorMsg.value = 'CSV 文件解析失败：' + error.message
    }
  }
  reader.readAsText(file)
}

// --- Excel 解析辅助函数 ---

const FIELD_MAPPINGS = {
  name: ['姓名', 'name', '名字', '选手', '参赛者'],
  club: ['俱乐部', 'club', '箭馆', '队伍', '俱乐部名称'],
  bow_type: ['弓种', 'bow_type', 'bow', '弓类', '弓的类型'],
  distance: ['距离', 'distance', '比赛距离', '距离(m)', '距离m'],
  format: ['赛制', 'format', '比赛', '赛制格式', '竞赛形式'],
  rank: ['排名', 'rank', '名次', '成绩排名', 'rank号']
}

const REQUIRED_FIELDS = ['name', 'club', 'bow_type', 'distance', 'format', 'rank']

const FIELD_LABELS = {
  name: '姓名', club: '俱乐部', bow_type: '弓种',
  distance: '距离', format: '赛制', rank: '排名'
}

const mapColumns = (headerRow) => {
  const columnMapping = {}
  for (const [fieldName, aliases] of Object.entries(FIELD_MAPPINGS)) {
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const headerValue = (headerRow[colIndex] || '').toString().trim().toLowerCase()
      if (aliases.some(alias => headerValue === alias.toLowerCase())) {
        columnMapping[fieldName] = colIndex
        break
      }
    }
  }
  return columnMapping
}

const createValueToCodeMap = (dictArray) => {
  const map = {}
  if (Array.isArray(dictArray)) {
    dictArray.forEach(item => {
      if (item.name && item.code) {
        map[item.name.toLowerCase().trim()] = item.code
      }
    })
  }
  return map
}

const convertToCode = (value, valueMap) => {
  const trimmedValue = (value || '').toString().trim()
  if (!trimmedValue) return trimmedValue
  if (valueMap[trimmedValue.toLowerCase()]) {
    return valueMap[trimmedValue.toLowerCase()]
  }
  for (const [, code] of Object.entries(valueMap)) {
    if (code.toLowerCase() === trimmedValue.toLowerCase()) {
      return code
    }
  }
  return trimmedValue
}

const buildScoreUniqueKey = (item) => [
  normalizeKeyPart(item.name),
  normalizeKeyPart(item.club),
  normalizeKeyPart(item.bow_type),
  normalizeKeyPart(item.distance),
  normalizeKeyPart(item.format)
].join('|')

const buildClubAutoFillMap = (existingScores) => {
  const clubByNameAndBow = new Map()
  ;(existingScores || []).forEach(item => {
    const mappedClub = (item.club || '').toString().trim()
    const mappedName = (item.name || '').toString().trim()
    const mappedBow = (item.bow_type || '').toString().trim()
    if (!mappedClub || !mappedName || !mappedBow) return
    const key = [normalizeKeyPart(mappedName), normalizeKeyPart(mappedBow)].join('|')
    if (!clubByNameAndBow.has(key)) {
      clubByNameAndBow.set(key, mappedClub)
    }
  })
  return clubByNameAndBow
}

const markInFileDuplicates = (scores, keyToIndexes) => {
  keyToIndexes.forEach(indexes => {
    if (indexes.length < 2) return
    indexes.forEach((idx, order) => {
      if (!scores[idx]) return
      scores[idx].__duplicate_in_file = true
      if (order > 0) {
        scores[idx].__duplicate_in_file_to_remove = true
        scores[idx].__duplicate = true
      }
    })
  })
}

// 解析 Excel/CSV 数据
const parseExcelData = (jsonData) => {
  parseMsg.clear()

  if (!jsonData || jsonData.length === 0) {
    parseMsg.errorMsg.value = '文件为空'
    return
  }

  const headerRow = jsonData[0]
  if (!headerRow) {
    parseMsg.errorMsg.value = '无法读取列标题'
    return
  }

  const columnMapping = mapColumns(headerRow)
  const missingFields = REQUIRED_FIELDS.filter(f => columnMapping[f] === undefined)
  if (missingFields.length > 0) {
    const missingLabels = missingFields.map(f => FIELD_LABELS[f]).join('、')
    parseMsg.errorMsg.value = `Excel 文件缺少必需字段：${missingLabels}。列标题应包括：姓名、俱乐部、弓种、距离、赛制、排名`
    return
  }

  const bowTypeMap = createValueToCodeMap(bowTypes.value)
  const distanceMap = createValueToCodeMap(distances.value)
  const formatMap = createValueToCodeMap(competitionFormats.value)

  const bowCodeSet = new Set((bowTypes.value || []).map(item => item.code))
  const distanceCodeSet = new Set((distances.value || []).map(item => item.code))
  const formatCodeSet = new Set((competitionFormats.value || []).map(item => item.code))
  const existingScoreKeySet = new Set(
    (managedScores.value || []).map(item => buildScoreUniqueKey(item))
  )

  const clubByNameAndBow = buildClubAutoFillMap(managedScores.value)
  const parsedScoreKeyToIndexes = new Map()

  // 解析数据行
  const newScores = []
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || !row[columnMapping.name] || (typeof row[columnMapping.name] === 'string' && !row[columnMapping.name].trim())) {
      continue // 跳过空行或没有姓名的行
    }

    const name = (row[columnMapping.name] || '').toString().trim()
    let club = (row[columnMapping.club] || '').toString().trim()
    let bow_type = (row[columnMapping.bow_type] || '').toString().trim()
    let distance = (row[columnMapping.distance] || '').toString().trim()
    let format = (row[columnMapping.format] || '').toString().trim()
    const rank = parseInt(row[columnMapping.rank], 10)

    // 转换字典值为代码
    bow_type = convertToCode(bow_type, bowTypeMap)
    distance = convertToCode(distance, distanceMap)
    format = convertToCode(format, formatMap)

    // 在解析阶段按“姓名+弓种”自动补全俱乐部：优先使用本次文件已解析映射，其次用已存在成绩映射
    if (name && bow_type) {
      const clubMapKey = [normalizeKeyPart(name), normalizeKeyPart(bow_type)].join('|')
      if (club) {
        clubByNameAndBow.set(clubMapKey, club)
      } else if (clubByNameAndBow.has(clubMapKey)) {
        club = clubByNameAndBow.get(clubMapKey) || ''
      }
    }

    const rowErrors = []
    if (!name) rowErrors.push('姓名不能为空')
    if (!bow_type || !bowCodeSet.has(bow_type)) rowErrors.push(`弓种无效：${bow_type || '-'}`)
    if (!distance || !distanceCodeSet.has(distance)) rowErrors.push(`距离无效：${distance || '-'}`)
    if (!format || !formatCodeSet.has(format)) rowErrors.push(`赛制无效：${format || '-'}`)
    if (!Number.isInteger(rank) || rank < 1) rowErrors.push('排名必须是正整数')

    const scoreUniqueKey = buildScoreUniqueKey({ name, club, bow_type, distance, format })
    const isDuplicate = rowErrors.length === 0 && existingScoreKeySet.has(scoreUniqueKey)
    newScores.push({
      event_id: parseInt(selectedEventId.value),
      name,
      club: club || '',
      bow_type,
      distance,
      format,
      rank,
      __valid: rowErrors.length === 0,
      __errors: rowErrors,
      __duplicate: isDuplicate,
      __duplicate_in_file: false,
      __duplicate_in_file_to_remove: false,
      __duplicate_with_existing: isDuplicate
    })

    if (rowErrors.length === 0) {
      const currentIndex = newScores.length - 1
      const indexes = parsedScoreKeyToIndexes.get(scoreUniqueKey) || []
      indexes.push(currentIndex)
      parsedScoreKeyToIndexes.set(scoreUniqueKey, indexes)
    }
  }

  // 标记文件内重复：同一键出现多次时，仅保留第一条为非“移除”，其余标为“重复（将移除）”
  markInFileDuplicates(newScores, parsedScoreKeyToIndexes)

  const inFileDuplicateCount = newScores.filter(item => item.__valid && item.__duplicate_in_file).length

  if (newScores.length === 0) {
    parseMsg.errorMsg.value = '文件中没有有效的成绩数据'
    return
  }

  batchScores.value = newScores
  const validCount = newScores.filter(item => item.__valid).length
  const invalidCount = newScores.length - validCount
  const duplicateCount = newScores.filter(item => item.__valid && item.__duplicate).length
  const inFileDuplicateToRemove = newScores.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length
  if (invalidCount > 0) {
    parseMsg.successMsg.value = `已解析 ${newScores.length} 条：合法 ${validCount} 条，异常 ${invalidCount} 条；与已有成绩重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）`
  } else {
    parseMsg.successMsg.value = `成功解析 ${newScores.length} 条成绩，全部合法；与已有成绩重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）。`
  }
}

const recalcDuplicateFlags = () => {
  const keyToIndexes = new Map()
  batchScores.value.forEach((item, idx) => {
    if (!item.__valid) return
    const key = buildScoreUniqueKey(item)
    const arr = keyToIndexes.get(key) || []
    arr.push(idx)
    keyToIndexes.set(key, arr)
  })

  const existingScoreKeySet = new Set(
    (managedScores.value || []).map(item => buildScoreUniqueKey(item))
  )

  batchScores.value.forEach((item, idx) => {
    if (!item.__valid) return
    const key = buildScoreUniqueKey(item)
    const indexes = keyToIndexes.get(key) || []
    const isInFileDup = indexes.length > 1
    const isFirstOccurrence = indexes[0] === idx
    const isExistingDup = existingScoreKeySet.has(key)
    item.__duplicate_in_file = isInFileDup
    item.__duplicate_in_file_to_remove = isInFileDup && !isFirstOccurrence
    item.__duplicate_with_existing = isExistingDup
    item.__duplicate = item.__duplicate_in_file_to_remove || isExistingDup
  })
}

const removeBatchScore = (index) => {
  batchScores.value.splice(index, 1)
  recalcDuplicateFlags()
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

  try {
    const validScores = batchScores.value
      .filter(item => item.__valid && !item.__duplicate_in_file_to_remove)
      .map(item => ({
        event_id: item.event_id,
        name: item.name,
        club: item.club,
        bow_type: item.bow_type,
        distance: item.distance,
        format: item.format,
        rank: item.rank
      }))

    const dedupedScoresMap = new Map()
    validScores.forEach(item => {
      dedupedScoresMap.set(buildScoreUniqueKey(item), item)
    })
    const dedupedValidScores = Array.from(dedupedScoresMap.values())

    await scoreAPI.batchImport({ scores: dedupedValidScores })
    const duplicateCount = duplicateScoreCount.value
    const inFileDuplicateCount = inFileDuplicateScoreCount.value
    const inFileDuplicateToRemove = inFileDuplicateToRemoveCount.value
    const existingDuplicateCount = existingDuplicateScoreCount.value
    if (duplicateCount > 0) {
      submitMsg.show('success', `成功导入 ${dedupedValidScores.length} 条成绩（原始合法 ${validScoreCount.value} 条）；其中与已有成绩重复 ${existingDuplicateCount} 条（覆盖更新），文件内重复 ${inFileDuplicateCount} 条（已移除 ${inFileDuplicateToRemove} 条）`)
    } else {
      submitMsg.show('success', `成功导入 ${dedupedValidScores.length} 条成绩`)
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
        // Pydantic 验证错误
        if (Array.isArray(error.detail)) {
          // 构建错误映射 - 找出具体哪一行数据出错
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
            
            // 获取是第几条成绩
            if (loc && loc.length >= 2 && loc[0] === 'body' && loc[1] === 'scores') {
              const scoreIndex = parseInt(loc[2])
              const lineNo = scoreIndex + 1 // 数组从0开始，显示时+1
              const scoreName = batchScores.value[scoreIndex]?.name || '未知'
              
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
