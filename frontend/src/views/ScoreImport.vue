<template>
  <div class="score-import-page safe-area">
    <div class="page-header">
      <div class="header-top">
        <button class="btn-back" @click="$router.back()" title="返回积分排名">
          ← 返回
        </button>
        <div>
          <h1>导入成绩</h1>
          <p class="subtitle">为赛事导入参赛者成绩</p>
        </div>
        <button class="btn-add-event" @click="navigateToAddEvent" title="新增赛事">
          ➕ 新增赛事
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
            ➕ 新增赛事
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
            <div class="info-title">赛事配置</div>
            <table class="config-table">
              <thead>
                <tr>
                  <th>弓种</th>
                  <th>距离</th>
                  <th>赛制</th>
                  <th>参赛人数</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="config in selectedEvent.configurations" :key="`${config.bow_type}-${config.distance}-${config.format}`">
                  <td>{{ getBowTypeLabel(config.bow_type) }}</td>
                  <td>{{ config.distance }}</td>
                  <td>{{ getFormatLabel(config.format) }}</td>
                  <td>{{ config.participant_count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 批量导入 -->
      <div class="section" v-if="selectedEvent">
        <h2 class="section-title">导入方式</h2>
        
        <div class="import-tabs">
          <button 
            v-for="tab in importTabs" 
            :key="tab.id"
            :class="['tab', { active: activeTab === tab.id }]"
            @click="activeTab = tab.id"
          >
            {{ tab.label }}
          </button>
        </div>

        <!-- 单条录入 -->
        <div v-show="activeTab === 'single'" class="import-section">
          <form @submit.prevent="addSingleScore" class="single-form">
            <div class="form-group">
              <label for="name">姓名 *</label>
              <input 
                id="name"
                v-model="singleScore.name" 
                type="text"
                placeholder="选手姓名"
                required
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="club">俱乐部</label>
              <input 
                id="club"
                v-model="singleScore.club" 
                type="text"
                placeholder="俱乐部名称"
                class="form-input"
              />
            </div>

            <div class="form-group">
              <label for="bow-type">弓种 *</label>
              <select v-model="singleScore.bow_type" id="bow-type" required class="form-input">
                <option value="">请选择</option>
                <option v-for="bow in bowTypes" :key="bow.code" :value="bow.code">
                  {{ bow.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="distance">距离 *</label>
              <select v-model="singleScore.distance" id="distance" required class="form-input">
                <option value="">请选择</option>
                <option v-for="distance in distances" :key="distance.code" :value="distance.code">
                  {{ distance.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="format">赛制 *</label>
              <select v-model="singleScore.format" id="format" required class="form-input">
                <option value="">请选择</option>
                <option v-for="format in competitionFormats" :key="format.code" :value="format.code">
                  {{ format.name }}
                </option>
              </select>
            </div>

            <div class="form-group">
              <label for="rank">排名 *</label>
              <input 
                id="rank"
                v-model.number="singleScore.rank" 
                type="number"
                min="1"
                placeholder="排名"
                required
                class="form-input"
              />
            </div>

            <button type="submit" class="btn-add">
              + 添加成绩
            </button>
          </form>

          <!-- 已添加的成绩列表 -->
          <div v-if="batchScores.length > 0" class="scores-preview">
            <h3>待导入成绩 ({{ batchScores.length }}条)</h3>
            <table class="preview-table">
              <thead>
                <tr>
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
                <tr v-for="(score, index) in batchScores" :key="index">
                  <td>{{ score.name }}</td>
                  <td>{{ score.club || '-' }}</td>
                  <td>{{ getBowTypeLabel(score.bow_type) }}</td>
                  <td>{{ score.distance }}</td>
                  <td>{{ getFormatLabel(score.format) }}</td>
                  <td>{{ score.rank }}</td>
                  <td>
                    <button @click="batchScores.splice(index, 1)" class="btn-remove-small">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- CSV/Excel导入 -->
        <div v-show="activeTab === 'bulk'" class="import-section">
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
              <em style="font-size: 12px; color: #999;">弓种、距离、赛制的值支持使用字典名称（如"反曲弓"、"30m"、"排位赛"）或代码（如"recurve"、"ranking"）</em><br/>
              系统会自动识别列标题并匹配字段
            </p>
          </div>
          <div v-if="uploadedFileName" class="file-info">
            已选择：{{ uploadedFileName }}
          </div>
        </div>

        <!-- 导入按钮 -->
        <div class="import-actions">
          <button 
            type="button"
            @click="$router.back()"
            class="btn-cancel"
          >
            取消
          </button>
          <button 
            type="button"
            @click="submitImport"
            v-if="batchScores.length > 0"
            class="btn-submit"
            :disabled="importLoading"
          >
            {{ importLoading ? '导入中...' : `确认导入 (${batchScores.length}条)` }}
          </button>
        </div>
      </div>
    </div>

    <!-- 提示信息 -->
    <div v-if="successMessage" class="success-message">
      {{ successMessage }}
    </div>
    <div v-if="errorMessage" class="error-message">
      {{ errorMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, scoreAPI, dictionaryAPI } from '@/api'
import * as XLSX from 'xlsx'

const router = useRouter()
const events = ref([])
const selectedEventId = ref('')
const selectedEvent = ref(null)
const activeTab = ref('single')
const batchScores = ref([])
const importLoading = ref(false)
const successMessage = ref('')
const errorMessage = ref('')
const uploadedFileName = ref('')
const fileInput = ref(null)

// 字典数据
const bowTypes = ref([])
const distances = ref([])
const competitionFormats = ref([])

const importTabs = [
  { id: 'single', label: '逐条录入' },
  { id: 'bulk', label: '批量导入' }
]

const singleScore = ref({
  name: '',
  club: '',
  bow_type: '',
  distance: '',
  format: '',
  rank: null
})

// 获取弓种标签
const getBowTypeLabel = (type) => {
  const labels = {
    'recurve': '反曲弓',
    'compound': '复合弓',
    'barebow': '光弓',
    'traditional': '传统弓'
  }
  return labels[type] || type
}

// 获取赛制标签
const getFormatLabel = (format) => {
  const labels = {
    'ranking': '排位赛',
    'elimination': '淘汰赛',
    'mixed_doubles': '混双赛',
    'team': '团体赛'
  }
  return labels[format] || format
}

// 加载字典数据
const loadDictionaries = async () => {
  try {
    const response = await dictionaryAPI.getAll()
    if (response.success && response.data) {
      bowTypes.value = response.data.bowTypes || []
      distances.value = response.data.distances || []
      competitionFormats.value = response.data.competitionFormats || []
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
    // 如果列表为空，显示友好提示
  } catch (error) {
  }
}

// 赛事选择
const onEventSelected = async () => {
  if (!selectedEventId.value) {
    selectedEvent.value = null
    return
  }

  try {
    const response = await eventAPI.getDetail(selectedEventId.value)
    selectedEvent.value = response
  } catch (error) {
    errorMessage.value = '加载赛事信息失败'
    console.error('Error loading event:', error)
  }
}

// 添加单条成绩
const addSingleScore = () => {
  if (!singleScore.value.name || !singleScore.value.bow_type || !singleScore.value.distance || !singleScore.value.format || !singleScore.value.rank) {
    errorMessage.value = '请填写必填项'
    return
  }

  batchScores.value.push({
    event_id: parseInt(selectedEventId.value),
    name: singleScore.value.name,
    club: singleScore.value.club || '',
    bow_type: singleScore.value.bow_type,
    distance: singleScore.value.distance,
    format: singleScore.value.format,
    rank: singleScore.value.rank
  })

  // 重置表单
  singleScore.value = {
    name: '',
    club: '',
    bow_type: '',
    distance: '',
    format: '',
    rank: null
  }
  
  errorMessage.value = ''
}

// 文件选择
const onFileSelected = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  uploadedFileName.value = file.name
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
    
    if (isExcel) {
      // Excel 文件处理
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result)
          const workbook = XLSX.read(data, { type: 'array' })
          const sheetName = workbook.SheetNames[0]
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
          
          parseExcelData(jsonData)
        } catch (error) {
          errorMessage.value = 'Excel 文件解析失败：' + error.message
        }
      }
      reader.readAsArrayBuffer(file)
    } else if (file.name.endsWith('.csv')) {
      // CSV 文件处理
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const csv = e.target.result
          const lines = csv.split('\n')
          const jsonData = lines.map(line => 
            line.split(',').map(p => p.trim())
          )
          parseExcelData(jsonData)
        } catch (error) {
          errorMessage.value = 'CSV 文件解析失败：' + error.message
        }
      }
      reader.readAsText(file)
    } else {
      errorMessage.value = '请上传 .xlsx, .xls 或 .csv 格式的文件'
    }
  } catch (error) {
    errorMessage.value = '文件处理失败：' + error.message
  }
}

// 解析 Excel/CSV 数据
const parseExcelData = (jsonData) => {
  if (!jsonData || jsonData.length === 0) {
    errorMessage.value = '文件为空'
    return
  }

  // 字段映射 - 支持多种列名变体
  const fieldMappings = {
    name: ['姓名', 'name', '名字', '选手', '参赛者'],
    club: ['俱乐部', 'club', '组织', '队伍', '俱乐部名称'],
    bow_type: ['弓种', 'bow_type', 'bow', '弓类', '弓的类型'],
    distance: ['距离', 'distance', '比赛距离', '距离(m)', '距离m'],
    format: ['赛制', 'format', '比赛格式', '赛制格式', '竞赛形式'],
    rank: ['排名', 'rank', '名次', '成绩排名', 'rank号']
  }

  // 获取第一行作为列标题
  const headerRow = jsonData[0]
  if (!headerRow) {
    errorMessage.value = '无法读取列标题'
    return
  }

  // 创建字段映射
  const columnMapping = {}
  const requiredFields = ['name', 'distance', 'format', 'rank']
  const allRequiredFieldsPresent = []

  // 尝试匹配每个字段
  for (const [fieldName, aliases] of Object.entries(fieldMappings)) {
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const headerValue = (headerRow[colIndex] || '').toString().trim().toLowerCase()
      if (aliases.some(alias => headerValue === alias.toLowerCase())) {
        columnMapping[fieldName] = colIndex
        if (requiredFields.includes(fieldName)) {
          allRequiredFieldsPresent.push(fieldName)
        }
        break
      }
    }
  }

  // 验证必需字段
  const missingFields = requiredFields.filter(f => !allRequiredFieldsPresent.includes(f))
  if (missingFields.length > 0) {
    const fieldLabels = {
      'name': '姓名',
      'distance': '距离',
      'format': '赛制',
      'rank': '排名'
    }
    const missingLabels = missingFields.map(f => fieldLabels[f]).join('、')
    errorMessage.value = `Excel 文件缺少必需字段：${missingLabels}。列标题应包括：姓名、距离、赛制、排名`
    return
  }

  // 验证弓种字段
  if (!columnMapping['bow_type']) {
    errorMessage.value = `Excel 文件缺少"弓种"字段。请确保列标题包括：姓名、俱乐部、弓种、距离、赛制、排名`
    return
  }

  // 验证俱乐部字段
  if (!columnMapping['club']) {
    errorMessage.value = `Excel 文件缺少"俱乐部"字段。请确保列标题为（按顺序）：姓名、俱乐部、弓种、距离、赛制、排名`
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
  const convertToCode = (value, valueMap, fieldName) => {
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

  // 解析数据行
  const newScores = []
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || !row[columnMapping.name] || (typeof row[columnMapping.name] === 'string' && !row[columnMapping.name].trim())) {
      continue // 跳过空行或没有姓名的行
    }

    const name = (row[columnMapping.name] || '').toString().trim()
    const club = (row[columnMapping.club] || '').toString().trim()
    let bow_type = (row[columnMapping.bow_type] || '').toString().trim()
    let distance = (row[columnMapping.distance] || '').toString().trim()
    let format = (row[columnMapping.format] || '').toString().trim()
    const rank = parseInt(row[columnMapping.rank])

    // 转换字典值为代码
    bow_type = convertToCode(bow_type, bowTypeMap, 'bow_type')
    distance = convertToCode(distance, distanceMap, 'distance')
    format = convertToCode(format, formatMap, 'format')

    // 基本验证
    if (!name || !bow_type || !distance || !format || isNaN(rank) || rank < 1) {
      continue
    }

    newScores.push({
      event_id: parseInt(selectedEventId.value),
      name,
      club: club || '',
      bow_type,
      distance,
      format,
      rank
    })
  }

  if (newScores.length === 0) {
    errorMessage.value = '文件中没有有效的成绩数据'
    return
  }

  batchScores.value = newScores
  successMessage.value = `成功解析 ${newScores.length} 条成绩。`
  activeTab.value = 'single'
}

// 提交导入
const submitImport = async () => {
  if (batchScores.value.length === 0) {
    errorMessage.value = '请先添加成绩'
    return
  }

  importLoading.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    // 再次验证数据
    const validScores = []
    const validationErrors = []
    
    // 构建字典映射
    const bowTypeMap = {}
    const formatMap = {}
    const distanceMap = {}
    
    bowTypes.value.forEach(b => {
      bowTypeMap[b.code] = b.name
    })
    competitionFormats.value.forEach(f => {
      formatMap[f.code] = f.name
    })
    distances.value.forEach(d => {
      distanceMap[d.code] = d.name
    })
    
    for (let i = 0; i < batchScores.value.length; i++) {
      const score = batchScores.value[i]
      const lineNo = i + 1
      const errors = []
      
      if (!score.event_id || !Number.isInteger(score.event_id) || score.event_id < 1) {
        errors.push(`无效的赛事ID`)
      }
      if (!score.name || score.name.length === 0) {
        errors.push(`选手姓名不能为空`)
      }
      if (!score.bow_type || score.bow_type.length === 0) {
        errors.push(`弓种不能为空`)
      }
      if (!score.distance || score.distance.length === 0) {
        errors.push(`距离不能为空`)
      }
      if (!score.format || score.format.length === 0) {
        errors.push(`赛制不能为空`)
      }
      if (!Number.isInteger(score.rank) || score.rank < 1) {
        errors.push(`排名必须是正整数`)
      }
      
      if (errors.length > 0) {
        validationErrors.push(`第 ${lineNo} 条成绩（${score.name}）：${errors.join('；')}`)
      } else {
        validScores.push(score)
      }
    }
    
    if (validationErrors.length > 0) {
      throw new Error(validationErrors.join('\n'))
    }

    const response = await scoreAPI.batchImport({ scores: validScores })
    successMessage.value = `成功导入 ${batchScores.value.length} 条成绩`
    
    // 获取导入成绩中的首个弓种，用于跳转时传递参数
    const firstBowType = batchScores.value.length > 0 ? batchScores.value[0].bow_type : ''
    batchScores.value = []
    
    setTimeout(() => {
      // 跳转到PointsDisplay，并传递弓种参数
      if (firstBowType) {
        router.push(`/points-display?bowType=${firstBowType}`)
      } else {
        router.push('/points-display')
      }
    }, 1500)
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
    
    errorMessage.value = errorMsg
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
  errorMessage.value = ''
  successMessage.value = ''
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
  }

  .config-table {
    width: 100%;
    font-size: 12px;
    border-collapse: collapse;

    th {
      background: transparent;
      border-bottom: 1px solid #e0e0e0;
      padding: 8px;
      text-align: left;
      font-weight: 600;
      color: #666;
    }

    td {
      padding: 8px;
      border-bottom: 1px solid #f0f0f0;
      color: #333;
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

.import-tabs {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  border-bottom: 1px solid #e0e0e0;

  .tab {
    flex: 1;
    padding: 10px;
    background: transparent;
    border: none;
    border-bottom: 3px solid transparent;
    color: #666;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.3s;

    &.active {
      color: #667eea;
      border-bottom-color: #667eea;
    }
  }
}

.import-section {
  animation: fadeIn 0.3s ease;
}

.single-form {
  margin-bottom: 20px;

  .form-group {
    margin-bottom: 12px;
  }
}

.btn-add {
  width: 100%;
  padding: 10px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  margin-bottom: 20px;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
  }
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
</style>
