<template>
  <section class="wizard-coverage" :aria-busy="loading">
    <div class="coverage-heading">
      <h2>{{ title }}</h2>
      <button type="button" class="btn-refresh" data-test="coverage-reload" :disabled="loading" @click="reload">重新核查</button>
    </div>
    <p class="coverage-help">仅核查本赛事已保存的数据，不采信尚未提交的导入预览。打勾表示该精确组合至少有一条记录；这是按组合覆盖的核查，不保证逐名无遗漏。暂无记录不表示该组合必须参赛，请结合实际参赛情况核对。</p>
    <p v-if="kind === 'registrations'" class="coverage-help">报名按比赛弓种和距离合计，不按积分弓种或性别拆分。</p>
    <div v-if="error" class="failure-notice" role="alert" data-test="coverage-error">
      <div><strong>核查数据加载失败</strong><p>{{ error }}</p></div>
      <button type="button" class="btn-retry-inline" :disabled="loading" @click="reload">重试核查</button>
    </div>
    <p v-else-if="loading" class="empty-tip" role="status">正在完整读取字典及已保存记录…</p>
    <template v-else-if="loaded">
      <p class="empty-tip" data-test="coverage-summary" role="status">已读取 {{ records.length }} 条已保存记录；{{ coveredCount }} / {{ rows.length }} 个展示组合有记录。</p>
      <p v-if="!records.length" class="empty-tip" data-test="coverage-empty">本赛事暂无已保存的{{ kind === 'registrations' ? '报名' : '成绩' }}记录，可根据实际情况返回上一步补充。</p>
      <p v-if="!rows.length" class="empty-tip">字典未提供可枚举的弓种距离组合，当前也无已有组合。</p>
      <div v-else>
        <div v-if="hasFilters" class="filter-summary">
          <span role="status">筛选结果：{{ visibleRows.length }} / {{ rows.length }} 个组合</span>
          <button type="button" class="btn-clear-filters" @click="clearFilters">清除筛选</button>
        </div>
        <div class="manage-table-wrap">
          <table class="manage-table">
            <thead>
              <tr>
                <th v-for="column in columns" :key="column.key" scope="col">
                  <label class="coverage-filter">
                    {{ column.title }}
                    <select v-model="filters[column.key]" :aria-label="'筛选' + column.title" :data-filter="column.key">
                      <option value="">全部</option>
                      <option v-for="option in filterOptions[column.key]" :key="option.value" :value="option.value">{{ option.label }}</option>
                    </select>
                  </label>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-if="!visibleRows.length"><td :colspan="columns.length" class="no-filter-matches">暂无符合筛选条件的组合。</td></tr>
              <tr v-for="row in visibleRows" :key="row.key" data-test="coverage-row" :data-covered="row.covered" :data-combination="row.key">
                <td v-for="column in columns" :key="column.key" :class="{ 'coverage-present': column.key === 'covered' && row.covered }">{{ cellLabel(column, row) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { eventRegistrationAPI, scoreAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { getAllPages } from '@/utils/pagination'
import { buildCoverageRows } from '@/utils/wizardCoverage'

const props = defineProps({
  event: { type: Object, required: true },
  kind: { type: String, required: true, validator: value => ['registrations', 'scores'].includes(value) },
})
const emit = defineEmits(['ready'])
const { loadDictionaries } = useDictionaries()
const loading = ref(false)
const loaded = ref(false)
const error = ref('')
const records = ref([])
const dictionaries = ref({})
let requestId = 0
let disposed = false
const title = computed(() => props.kind === 'registrations' ? '报名覆盖核查' : '成绩覆盖核查')
const rows = ref([])
const coveredCount = computed(() => rows.value.filter(row => row.covered).length)
const label = (items = [], value) => items.find(item => item?.code === value)?.name || value || '未设置'
const columns = computed(() => [
  { key: 'bowType', title: '比赛弓种', label: value => label(dictionaries.value.bowTypes, value) },
  { key: 'distance', title: '距离', label: value => label(dictionaries.value.distances, value) },
  ...(props.kind === 'scores' ? [
    { key: 'format', title: '赛制', label: value => label(dictionaries.value.competitionFormats, value) },
    { key: 'genderGroup', title: '分组', label: value => value ? label(dictionaries.value.competitionGenderGroups, value) : '未分组（已有数据）' },
  ] : []),
  { key: 'covered', title: '覆盖状态', label: value => value ? '已有记录' : '暂无记录' },
  { key: 'count', title: '记录条数', label: String },
])
const cellLabel = (column, row) => {
  const prefix = column.key === 'covered' ? (row.covered ? '✓ ' : '— ') : ''
  return prefix + column.label(row[column.key])
}
const filters = ref({})
const clearFilters = () => { filters.value = Object.fromEntries(columns.value.map(column => [column.key, ''])) }
const filterOptions = computed(() => Object.fromEntries(columns.value.map(column => [
  column.key,
  [...new Set(rows.value.map(row => row[column.key]))].map(value => ({ value: JSON.stringify(value), label: column.label(value) })),
])))
const hasFilters = computed(() => columns.value.some(column => filters.value[column.key]))
const visibleRows = computed(() => rows.value.filter(row => columns.value.every(column =>
  !filters.value[column.key] || filters.value[column.key] === JSON.stringify(row[column.key]),
)))

const load = async () => {
  const currentId = ++requestId
  const event = { ...props.event }
  const kind = props.kind
  const isCurrent = () => !disposed && requestId === currentId
  emit('ready', false)
  loading.value = true
  loaded.value = false
  error.value = ''
  records.value = []
  rows.value = []
  try {
    if (!Number.isSafeInteger(event.id) || event.id < 1 || !Number.isSafeInteger(event.year) || !event.season || !['registrations', 'scores'].includes(kind)) throw new Error('请先选择有效赛事')
    const data = await loadDictionaries()
    if (!isCurrent()) return
    if (['bowTypes', 'distances', 'competitionGroups', 'competitionFormats', 'competitionGenderGroups'].some(key => !Array.isArray(data[key]))) throw new Error('字典响应不完整，请重试')
    const eventParams = kind === 'registrations' ? { year: event.year, season: event.season } : { event_id: event.id }
    const fetchPage = kind === 'registrations' ? eventRegistrationAPI.getList : scoreAPI.getList
    const saved = await getAllPages(async params => {
      if (!isCurrent()) throw new Error('核查已取消')
      const response = await fetchPage(params)
      if (!isCurrent()) throw new Error('核查已取消')
      return response
    }, eventParams)
    if (!isCurrent()) return
    const wrongEvent = saved.some(record => kind === 'registrations'
      ? record.year !== event.year || record.season !== event.season
      : record.event_id !== event.id)
    if (wrongEvent) throw new Error('返回记录不属于当前赛事，请重试')
    rows.value = buildCoverageRows(kind, saved, data)
    dictionaries.value = data
    records.value = saved
    for (const { key } of columns.value) {
      if (!filterOptions.value[key].some(option => option.value === filters.value[key])) filters.value[key] = ''
    }
    loaded.value = true
    emit('ready', true)
  } catch (reason) {
    if (isCurrent()) error.value = typeof reason?.detail === 'string' ? reason.detail : reason?.message || '核查请求失败，请重试'
  } finally {
    if (isCurrent()) loading.value = false
  }
}
const reload = () => { if (!loading.value) return load() }
watch(() => [props.event?.id, props.event?.year, props.event?.season, props.kind], () => {
  clearFilters()
  load()
}, { immediate: true })
onBeforeUnmount(() => { disposed = true; requestId += 1 })
</script>

<style scoped lang="scss" src="@/styles/WizardCoverage.scss" />
