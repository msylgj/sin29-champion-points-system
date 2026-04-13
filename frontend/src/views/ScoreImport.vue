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
      <div class="section" v-if="selectedEvent">
        <h2 class="section-title">成绩管理</h2>
        <p class="section-help">仅支持查看和编辑当前赛事已有成绩，不支持新增。</p>

        <div v-if="managedScoresLoading" class="empty-tip">成绩加载中...</div>
        <div v-else-if="managedScores.length === 0" class="empty-tip">当前赛事暂无成绩</div>
        <div v-else>
          <div class="bow-tabs">
            <button
              v-for="tab in managedBowTabs"
              :key="tab.code"
              type="button"
              class="bow-tab"
              :class="{ active: tab.code === activeManageBowType }"
              @click="activeManageBowType = tab.code"
            >
              {{ tab.name }}
            </button>
          </div>

          <div class="manage-tools">
            <div class="manage-tool-left">
              <input
                v-model="manageNameKeyword"
                class="manage-search-input"
                type="text"
                placeholder="按姓名搜索"
              />
            </div>
            <div class="manage-tool-right">
              <label class="checkbox-inline">
                <input type="checkbox" v-model="showModifiedOnly" />
                仅显示已修改行
              </label>
              <button
                type="button"
                class="btn-batch-save"
                :disabled="batchSavingCurrentTab || modifiedCurrentTabCount === 0"
                @click="saveCurrentTabModifiedScores"
              >
                {{ batchSavingCurrentTab ? '批量保存中...' : `保存当前弓种修改 (${modifiedCurrentTabCount})` }}
              </button>
            </div>
          </div>

          <div class="table-wrapper manage-table-wrap">
            <table class="manage-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>姓名</th>
                  <th>俱乐部</th>
                  <th>弓种</th>
                  <th>距离</th>
                  <th>赛制</th>
                  <th>排名</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="score in filteredManagedScores" :key="score.id" :class="{ 'row-modified': isManagedScoreModified(score) }">
                  <td>{{ score.id }}</td>
                  <td><input v-model="score.name" class="cell-input" type="text" /></td>
                  <td><input v-model="score.club" class="cell-input" type="text" /></td>
                  <td>
                    <select v-model="score.bow_type" class="cell-input">
                      <option v-for="item in bowTypes" :key="item.code" :value="item.code">{{ item.name }}</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="score.distance" class="cell-input">
                      <option v-for="item in distances" :key="item.code" :value="item.code">{{ item.name }}</option>
                    </select>
                  </td>
                  <td>
                    <select v-model="score.format" class="cell-input">
                      <option v-for="item in competitionFormats" :key="item.code" :value="item.code">{{ item.name }}</option>
                    </select>
                  </td>
                  <td><input v-model.number="score.rank" class="cell-input" type="number" min="1" /></td>
                  <td class="action-cell">
                    <button type="button" class="btn-row-save" :disabled="savingScoreIds.has(score.id)" @click="saveManagedScore(score)">
                      {{ savingScoreIds.has(score.id) ? '保存中...' : '保存' }}
                    </button>
                    <button type="button" class="btn-row-reset" :disabled="savingScoreIds.has(score.id)" @click="resetManagedScore(score.id)">
                      重置
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
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
import { eventAPI, scoreAPI, dictionaryAPI } from '@/api'
import { useMessage } from '@/composables/useMessage'

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
const activeManageBowType = ref('')
const managedOriginalMap = ref({})
const savingScoreIds = ref(new Set())
const showModifiedOnly = ref(false)
const batchSavingCurrentTab = ref(false)
const manageNameKeyword = ref('')

// 字典数据
const bowTypes = ref([])
const distances = ref([])
const competitionFormats = ref([])
const competitionGroups = ref([])

const normalizeKeyPart = (value) => (value || '').toString().trim().toLowerCase()

const countRows = [
  { key: 'individual_participant_count', label: '个人（排位/淘汰）' },
  { key: 'mixed_doubles_team_count', label: '混双（队伍）' },
  { key: 'team_count', label: '团体（队伍）' }
]

const sortedDistances = computed(() => {
  return [...distances.value].sort((a, b) => parseInt(b.code, 10) - parseInt(a.code, 10))
})

const bowTypeEnumText = computed(() => bowTypes.value.map(item => `${item.name}(${item.code})`).join('、'))
const distanceEnumText = computed(() => distances.value.map(item => `${item.name}(${item.code})`).join('、'))
const formatEnumText = computed(() => competitionFormats.value.map(item => `${item.name}(${item.code})`).join('、'))
const validScoreCount = computed(() => batchScores.value.filter(item => item.__valid).length)
const invalidScoreCount = computed(() => batchScores.value.filter(item => !item.__valid).length)
const duplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate).length)
const inFileDuplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_in_file).length)
const inFileDuplicateToRemoveCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length)
const existingDuplicateScoreCount = computed(() => batchScores.value.filter(item => item.__valid && item.__duplicate_with_existing).length)
const managedBowTabs = computed(() => {
  const bowSet = new Set((managedScores.value || []).map(item => item.bow_type))
  const tabs = bowTypes.value.filter(item => bowSet.has(item.code))
  return tabs
})
const currentTabManagedScores = computed(() => {
  if (!activeManageBowType.value) return []
  return managedScores.value.filter(item => item.bow_type === activeManageBowType.value)
})
const modifiedCurrentTabCount = computed(() => {
  return currentTabManagedScores.value.filter(item => isManagedScoreModified(item)).length
})
const filteredManagedScores = computed(() => {
  if (!activeManageBowType.value) return []
  const keyword = (manageNameKeyword.value || '').trim().toLowerCase()
  const currentTabScores = managedScores.value.filter(item => {
    if (item.bow_type !== activeManageBowType.value) return false
    if (showModifiedOnly.value && !isManagedScoreModified(item)) return false
    if (keyword && !(item.name || '').toLowerCase().includes(keyword)) return false
    return true
  })

  // 默认排序：距离(大到小)、赛制、排名
  return [...currentTabScores].sort((a, b) => {
    const compareText = (left, right) => (left || '').localeCompare((right || ''), 'zh-CN')
    const compareNumber = (left, right) => Number(left || 0) - Number(right || 0)
    const parseDistance = (value) => {
      const match = String(value || '').match(/\d+/)
      return match ? Number(match[0]) : 0
    }

    const byDistanceDesc = parseDistance(b.distance) - parseDistance(a.distance)
    if (byDistanceDesc !== 0) return byDistanceDesc

    const byFormat = compareText(a.format, b.format)
    if (byFormat !== 0) return byFormat

    const byRank = compareNumber(a.rank, b.rank)
    return byRank
  })
})

const normalizeManagedScore = (score = {}) => ({
  name: (score.name || '').trim(),
  club: (score.club || '').trim(),
  bow_type: score.bow_type || '',
  distance: score.distance || '',
  format: score.format || '',
  rank: Number(score.rank || 0)
})

const isManagedScoreModified = (score) => {
  const original = managedOriginalMap.value[score.id]
  if (!original) return false

  const currentNormalized = normalizeManagedScore(score)
  const originalNormalized = normalizeManagedScore(original)
  return [
    'name',
    'club',
    'bow_type',
    'distance',
    'format',
    'rank'
  ].some(key => currentNormalized[key] !== originalNormalized[key])
}

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

const getGroupCode = (bowType, distance) => {
  const found = competitionGroups.value.find(
    item => item.bow_type === bowType && item.distance === distance
  )
  return found ? `${found.group_code}组` : '-'
}

const shouldShowDistance = (distance) => {
  return competitionGroups.value.some(item => item.distance === distance)
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
    const response = await dictionaryAPI.getAll()
    if (response.success && response.data) {
      bowTypes.value = response.data.bowTypes || []
      distances.value = response.data.distances || []
      competitionFormats.value = response.data.competitionFormats || []
      competitionGroups.value = response.data.competitionGroups || []
    }
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
  } catch (error) {
    events.value = []
    selectedEventId.value = ''
    selectedEvent.value = null
  }
}

const snapshotManagedScores = () => {
  const snapshot = {}
  managedScores.value.forEach(item => {
    snapshot[item.id] = { ...item }
  })
  managedOriginalMap.value = snapshot
}

const loadManagedScores = async () => {
  if (!selectedEventId.value) {
    managedScores.value = []
    managedOriginalMap.value = {}
    activeManageBowType.value = ''
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
    snapshotManagedScores()

    const tabs = managedBowTabs.value
    if (tabs.length > 0) {
      const hasCurrent = tabs.some(item => item.code === activeManageBowType.value)
      activeManageBowType.value = hasCurrent ? activeManageBowType.value : tabs[0].code
    } else {
      activeManageBowType.value = ''
    }
  } catch (error) {
    console.error('加载成绩管理数据失败:', error)
    pageMsg.errorMsg.value = '加载成绩失败'
    managedScores.value = []
    managedOriginalMap.value = {}
    activeManageBowType.value = ''
  } finally {
    managedScoresLoading.value = false
  }
}

const validateManagedScore = (score) => {
  if (!score.name || !score.name.trim()) return '姓名不能为空'
  if (!score.bow_type) return '请选择弓种'
  if (!score.distance) return '请选择距离'
  if (!score.format) return '请选择赛制'
  if (!Number.isInteger(Number(score.rank)) || Number(score.rank) < 1) return '排名必须是正整数'
  return ''
}

const saveManagedScore = async (score) => {
  const validationMsg = validateManagedScore(score)
  if (validationMsg) {
    pageMsg.errorMsg.value = `成绩 ID ${score.id}：${validationMsg}`
    return false
  }

  const set = new Set(savingScoreIds.value)
  set.add(score.id)
  savingScoreIds.value = set
  pageMsg.errorMsg.value = ''

  try {
    const payload = {
      name: score.name.trim(),
      club: score.club?.trim() ?? '',
      bow_type: score.bow_type,
      distance: score.distance,
      format: score.format,
      rank: Number(score.rank)
    }
    const updated = await scoreAPI.update(score.id, payload)
    const idx = managedScores.value.findIndex(item => item.id === score.id)
    if (idx >= 0) {
      managedScores.value[idx] = {
        id: updated.id,
        event_id: updated.event_id,
        name: updated.name || '',
        club: updated.club || '',
        bow_type: updated.bow_type || '',
        distance: updated.distance || '',
        format: updated.format || '',
        rank: Number(updated.rank || 0)
      }
    }
    snapshotManagedScores()
    pageMsg.successMsg.value = `成绩 ID ${score.id} 保存成功`
    return true
  } catch (error) {
    pageMsg.errorMsg.value = error.detail || error.message || '保存失败，请重试'
    console.error('保存成绩失败:', error)
    return false
  } finally {
    const nextSet = new Set(savingScoreIds.value)
    nextSet.delete(score.id)
    savingScoreIds.value = nextSet
  }
}

const saveCurrentTabModifiedScores = async () => {
  const changedScores = currentTabManagedScores.value.filter(item => isManagedScoreModified(item))
  if (changedScores.length === 0) {
    pageMsg.errorMsg.value = '当前弓种没有待保存的修改'
    return
  }

  batchSavingCurrentTab.value = true
  pageMsg.errorMsg.value = ''
  pageMsg.successMsg.value = ''

  let successCount = 0
  const failedItems = []

  for (const score of changedScores) {
    const validationMsg = validateManagedScore(score)
    if (validationMsg) {
      failedItems.push(`ID ${score.id}：${validationMsg}`)
      continue
    }

    const ok = await saveManagedScore(score)
    if (ok) {
      successCount += 1
    } else {
      failedItems.push(`ID ${score.id}：保存失败`)
    }
  }

  if (failedItems.length > 0) {
    pageMsg.errorMsg.value = `批量保存完成，成功 ${successCount} 条，失败 ${failedItems.length} 条\n${failedItems.join('\n')}`
  } else {
    pageMsg.successMsg.value = `批量保存成功，共 ${successCount} 条`
  }

  batchSavingCurrentTab.value = false
}

const resetManagedScore = (scoreId) => {
  const original = managedOriginalMap.value[scoreId]
  if (!original) return
  const idx = managedScores.value.findIndex(item => item.id === scoreId)
  if (idx >= 0) {
    managedScores.value[idx] = { ...original }
  }
}

// 赛事选择
const onEventSelected = async () => {
  if (!selectedEventId.value) {
    selectedEvent.value = null
    showEventConfig.value = false
    managedScores.value = []
    managedOriginalMap.value = {}
    activeManageBowType.value = ''
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

// 解析 Excel/CSV 数据
const parseExcelData = (jsonData) => {
  parseMsg.clear()

  if (!jsonData || jsonData.length === 0) {
    parseMsg.errorMsg.value = '文件为空'
    return
  }

  // 字段映射 - 支持多种列名变体
  const fieldMappings = {
    name: ['姓名', 'name', '名字', '选手', '参赛者'],
    club: ['俱乐部', 'club', '箭馆', '队伍', '俱乐部名称'],
    bow_type: ['弓种', 'bow_type', 'bow', '弓类', '弓的类型'],
    distance: ['距离', 'distance', '比赛距离', '距离(m)', '距离m'],
    format: ['赛制', 'format', '比赛', '赛制格式', '竞赛形式'],
    rank: ['排名', 'rank', '名次', '成绩排名', 'rank号']
  }

  // 获取第一行作为列标题
  const headerRow = jsonData[0]
  if (!headerRow) {
    parseMsg.errorMsg.value = '无法读取列标题'
    return
  }

  // 创建字段映射
  const columnMapping = {}
  const requiredFields = ['name', 'club', 'bow_type', 'distance', 'format', 'rank']

  // 尝试匹配每个字段
  for (const [fieldName, aliases] of Object.entries(fieldMappings)) {
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const headerValue = (headerRow[colIndex] || '').toString().trim().toLowerCase()
      if (aliases.some(alias => headerValue === alias.toLowerCase())) {
        columnMapping[fieldName] = colIndex
        break
      }
    }
  }

  // 验证必需字段
  const missingFields = requiredFields.filter(f => columnMapping[f] === undefined)
  if (missingFields.length > 0) {
    const fieldLabels = {
      'name': '姓名',
      'club': '俱乐部',
      'bow_type': '弓种',
      'distance': '距离',
      'format': '赛制',
      'rank': '排名'
    }
    const missingLabels = missingFields.map(f => fieldLabels[f]).join('、')
    parseMsg.errorMsg.value = `Excel 文件缺少必需字段：${missingLabels}。列标题应包括：姓名、俱乐部、弓种、距离、赛制、排名`
    return
  }

  // 创建字典值到代码的映射
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

  const bowTypeMap = createValueToCodeMap(bowTypes.value)
  const distanceMap = createValueToCodeMap(distances.value)
  const formatMap = createValueToCodeMap(competitionFormats.value)

  // 转换字典值为代码
  const convertToCode = (value, valueMap) => {
    const trimmedValue = (value || '').toString().trim()
    if (!trimmedValue) return trimmedValue

    // 首先尝试直接匹配（用户输入的可能就是代码）
    if (valueMap[trimmedValue.toLowerCase()]) {
      return valueMap[trimmedValue.toLowerCase()]
    }

    // 然后尝试模糊匹配（如果输入是代码形式）
    for (const [name, code] of Object.entries(valueMap)) {
      if (code.toLowerCase() === trimmedValue.toLowerCase()) {
        return code
      }
    }

    // 如果都没匹配上，返回原值
    return trimmedValue
  }

  const bowCodeSet = new Set((bowTypes.value || []).map(item => item.code))
  const distanceCodeSet = new Set((distances.value || []).map(item => item.code))
  const formatCodeSet = new Set((competitionFormats.value || []).map(item => item.code))
  const existingScoreKeySet = new Set(
    (managedScores.value || []).map(item => [
      normalizeKeyPart(item.name),
      normalizeKeyPart(item.club),
      normalizeKeyPart(item.bow_type),
      normalizeKeyPart(item.distance),
      normalizeKeyPart(item.format)
    ].join('|'))
  )

  const clubByNameAndBow = new Map()
  ;(managedScores.value || []).forEach(item => {
    const mappedClub = (item.club || '').toString().trim()
    const mappedName = (item.name || '').toString().trim()
    const mappedBow = (item.bow_type || '').toString().trim()
    if (!mappedClub || !mappedName || !mappedBow) return

    const key = [normalizeKeyPart(mappedName), normalizeKeyPart(mappedBow)].join('|')
    if (!clubByNameAndBow.has(key)) {
      clubByNameAndBow.set(key, mappedClub)
    }
  })

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

    const scoreUniqueKey = [
      normalizeKeyPart(name),
      normalizeKeyPart(club),
      normalizeKeyPart(bow_type),
      normalizeKeyPart(distance),
      normalizeKeyPart(format)
    ].join('|')
    const isDuplicate = rowErrors.length === 0 && existingScoreKeySet.has(scoreUniqueKey)
    const parsedScoreItem = {
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
    }
    newScores.push(parsedScoreItem)

    if (rowErrors.length === 0) {
      const currentIndex = newScores.length - 1
      const indexes = parsedScoreKeyToIndexes.get(scoreUniqueKey) || []
      indexes.push(currentIndex)
      parsedScoreKeyToIndexes.set(scoreUniqueKey, indexes)
    }
  }

  // 标记文件内重复：同一键出现多次时，仅保留第一条为非“移除”，其余标为“重复（将移除）”
  parsedScoreKeyToIndexes.forEach(indexes => {
    if (indexes.length < 2) return
    indexes.forEach((idx, order) => {
      if (!newScores[idx]) return
      newScores[idx].__duplicate_in_file = true
      if (order > 0) {
        newScores[idx].__duplicate_in_file_to_remove = true
        newScores[idx].__duplicate = true
      }
    })
  })

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
    const key = [
      normalizeKeyPart(item.name),
      normalizeKeyPart(item.club),
      normalizeKeyPart(item.bow_type),
      normalizeKeyPart(item.distance),
      normalizeKeyPart(item.format)
    ].join('|')
    const arr = keyToIndexes.get(key) || []
    arr.push(idx)
    keyToIndexes.set(key, arr)
  })

  const existingScoreKeySet = new Set(
    (managedScores.value || []).map(item => [
      normalizeKeyPart(item.name),
      normalizeKeyPart(item.club),
      normalizeKeyPart(item.bow_type),
      normalizeKeyPart(item.distance),
      normalizeKeyPart(item.format)
    ].join('|'))
  )

  batchScores.value.forEach((item, idx) => {
    if (!item.__valid) return
    const key = [
      normalizeKeyPart(item.name),
      normalizeKeyPart(item.club),
      normalizeKeyPart(item.bow_type),
      normalizeKeyPart(item.distance),
      normalizeKeyPart(item.format)
    ].join('|')
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
      const uniqueKey = [
        normalizeKeyPart(item.name),
        normalizeKeyPart(item.club),
        normalizeKeyPart(item.bow_type),
        normalizeKeyPart(item.distance),
        normalizeKeyPart(item.format)
      ].join('|')
      dedupedScoresMap.set(uniqueKey, item)
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

<style scoped lang="scss">
.score-import-page {
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

  .btn-back,
  .btn-add-event {
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
}

.import-container {
  padding: 0 15px;
}

.section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);

  .section-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 15px;
    color: #333;
  }

  .section-help {
    font-size: 12px;
    color: #888;
    margin: -6px 0 12px;
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
  }
}

.event-info {
  margin-top: 15px;

  .info-card {
    background: #f9f9f9;
    border-radius: 6px;
    padding: 12px;

    .info-title {
      font-size: 12px;
      font-weight: 600;
      color: #666;
      margin-bottom: 10px;
    }

    .config-toggle {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border: none;
      background: transparent;
      cursor: pointer;
      padding: 0;
      margin-bottom: 6px;

      .toggle-icon {
        font-size: 12px;
        color: #667eea;
      }
    }
  }
}

.empty-tip {
  padding: 12px;
  border-radius: 6px;
  background: #f7f8fc;
  color: #666;
  font-size: 13px;
}

.bow-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;

  .bow-tab {
    border: 1px solid #ccd4f5;
    background: #f7f8ff;
    color: #4f5c99;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 12px;
    cursor: pointer;

    &.active {
      background: #667eea;
      border-color: #667eea;
      color: #fff;
    }
  }
}

.manage-tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
  flex-wrap: wrap;

  .checkbox-inline {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    color: #4f5680;
    font-size: 12px;
  }

  .manage-tool-left {
    display: flex;
    align-items: center;
  }

  .manage-tool-right {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .manage-search-input {
    border: 1px solid #d7deef;
    border-radius: 6px;
    padding: 7px 10px;
    min-width: 180px;
    font-size: 12px;
    color: #333;
    background: #fff;
  }

  .btn-batch-save {
    border: none;
    border-radius: 6px;
    padding: 7px 12px;
    font-size: 12px;
    background: #4d79ff;
    color: #fff;
    cursor: pointer;
  }

  .btn-batch-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
}

.manage-table-wrap {
  max-height: 420px;
  border: 1px solid #eceff7;
  border-radius: 8px;
}

.manage-table {
  width: 100%;
  border-collapse: collapse;
  min-width: 920px;

  th,
  td {
    border-bottom: 1px solid #f0f2f8;
    padding: 8px;
    text-align: left;
    font-size: 12px;
    vertical-align: middle;
    background: #fff;
  }

  thead th {
    position: sticky;
    top: 0;
    z-index: 1;
    background: #f6f8fd;
    color: #3b4370;
    font-weight: 600;
  }

  .cell-input {
    width: 100%;
    border: 1px solid #d9deef;
    border-radius: 4px;
    padding: 6px 8px;
    font-size: 12px;
    color: #333;
    background: #fff;
  }

  .action-cell {
    white-space: nowrap;
  }

  .btn-row-save,
  .btn-row-reset {
    border: none;
    border-radius: 4px;
    padding: 5px 8px;
    font-size: 12px;
    cursor: pointer;
  }

  .btn-row-save {
    background: #4d79ff;
    color: #fff;
    margin-right: 6px;
  }

  .btn-row-reset {
    background: #eef1fb;
    color: #4c5684;
  }

  .btn-row-save:disabled,
  .btn-row-reset:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  tr.row-modified td {
    background: #fff9e8;
  }
}

.bow-config-group {
  margin-bottom: 20px;

  .bow-type-title {
    font-size: 14px;
    font-weight: 600;
    color: #667eea;
    margin: 10px 0 8px;
    padding-bottom: 6px;
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
  font-size: 12px;
  min-width: 400px;

  th, td {
    border: 1px solid #e0e0e0;
    padding: 8px;
    text-align: center;
  }

  th {
    background: #f5f5f5;
    font-weight: 600;
    color: #333;
  }

  td {
    background: white;

    &.format-label {
      font-weight: 500;
      color: #666;
      text-align: left;
      background: #f9f9f9;
    }
  }
}

.no-events-tip {
  text-align: center;
  padding: 30px 20px;
  background: #f0f4ff;
  border: 2px dashed #667eea;
  border-radius: 8px;
  color: #666;

  p {
    margin: 0 0 15px;
    font-size: 14px;
    color: #333;
  }
}

.btn-add-event-inline {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }

  &:active {
    transform: translateY(0);
  }
}

.import-section {
  animation: fadeIn 0.3s ease;
}

.scores-preview {
  h3 {
    font-size: 14px;
    font-weight: 600;
    margin-bottom: 10px;
    color: #333;
  }

  .preview-table {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;

    th {
      background: #f0f0f0;
      border-bottom: 1px solid #ddd;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      color: #333;
    }

    td {
      padding: 8px;
      border-bottom: 1px solid #f0f0f0;
      color: #666;
    }

    tr.row-error {
      background: #fff5f5;
    }

    tr.row-duplicate {
      background: #fffaf0;
    }
  }
}

.status-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 600;

  &.status-ok {
    background: #eaf8ee;
    color: #1e7b34;
    border: 1px solid #b6e1c1;
  }

  &.status-error {
    background: #ffecec;
    color: #b42318;
    border: 1px solid #f6b8b5;
    cursor: help;
  }

  &.status-duplicate {
    background: #fff6df;
    color: #8a5a00;
    border: 1px solid #f2d18b;
    cursor: help;
  }
}

.btn-remove-small {
  padding: 4px 8px;
  background: #ff4757;
  color: white;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;

  &:hover {
    background: #ff3838;
  }
}

.upload-area {
  text-align: center;
  padding: 20px;
  background: #f9f9f9;
  border: 2px dashed #ddd;
  border-radius: 6px;
  margin-bottom: 15px;

  .btn-upload {
    padding: 10px 20px;
    background: #667eea;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 10px;

    &:hover {
      background: #764ba2;
    }
  }

  .upload-help {
    font-size: 12px;
    color: #999;
    margin: 10px 0 0;
    line-height: 1.5;
  }
}

.file-info {
  padding: 10px;
  background: #e8f5e9;
  color: #2e7d32;
  border-radius: 6px;
  font-size: 12px;
  margin-top: 10px;
}

.import-actions {
  display: flex;
  gap: 10px;
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

.import-feedback {
  margin-top: 16px;

  .import-message {
    border-radius: 6px;
    padding: 10px 12px;
    font-size: 13px;
    white-space: pre-wrap;
    word-break: break-word;
    line-height: 1.5;
  }

  .import-message + .import-message {
    margin-top: 8px;
  }

  .import-message-success {
    background: #eaf8ee;
    color: #1e7b34;
    border: 1px solid #b6e1c1;
  }

  .import-message-error {
    background: #ffecec;
    color: #b42318;
    border: 1px solid #f6b8b5;
  }
}

.submit-floating-message {
  position: fixed;
  top: 16%;
  left: 50%;
  transform: translateX(-50%);
  min-width: min(520px, calc(100vw - 32px));
  max-width: min(720px, calc(100vw - 32px));
  padding: 12px 16px;
  border-radius: 8px;
  font-size: 14px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
  z-index: 1200;
  animation: slideDownFade 0.25s ease;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

.submit-floating-success {
  background: #2ed573;
  color: #fff;
}

.submit-floating-error {
  background: #ff4757;
  color: #fff;
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
  max-height: 150px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
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
  max-height: 200px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.5;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
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

@keyframes slideDownFade {
  from {
    transform: translate(-50%, -8px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}
</style>
