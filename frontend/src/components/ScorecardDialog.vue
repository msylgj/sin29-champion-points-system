<template>
  <AppConfirmDialog :open="open" title="生成记分纸" wide
    :message="'当前赛事：' + eventName + '。PDF 抬头以本场赛事为准，页脚按实际生成时的北京时间填写年月，不使用站位表中的赛事标题或日期。'"
    confirm-text="生成淘汰赛手卡" cancel-text="关闭"
    :busy="!!operation" :confirm-disabled="!canBatch" :return-focus="opener" @confirm="generateBatch" @cancel="close">
    <div class="scorecard-content">
      <section class="scorecard-section">
        <p>上传站位表、团混队伍表，可分别导入。</p>
        <div class="workbook-inputs">
          <div class="workbook">
            <label class="workbook">上传站位表（.xlsx）
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="!!operation" @change="chooseWorkbook($event, false)">
            </label>
            <p v-if="state.file">已导入：{{ state.file.name }} · 排位记分纸 {{ state.pages.length }} 页</p>
          </div>
          <div class="workbook">
            <label class="workbook">上传团混队伍表（.xlsx）
              <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="!!operation" @change="chooseWorkbook($event, true)">
            </label>
            <p v-if="state.teamFile">已导入：{{ state.teamFile.name }} · {{ state.teamSourceGroups.length }} 组</p>
          </div>
        </div>
        <p v-if="state.pendingSaves" role="status">正在保存本地草稿…</p>
        <p v-else-if="state.storageError" class="error" role="alert">{{ state.storageError }}</p>
        <p v-else-if="state.file || state.teamFile" class="storage-note">草稿已保存到此浏览器，刷新后可继续填写。</p>
        <a v-if="state.rankingUrl" :href="state.rankingUrl" :download="eventName + '_排位记分纸.pdf'">下载排位记分纸 PDF</a>
      </section>
      <p v-if="operation" role="status" class="progress">{{ operation }}</p>
      <p v-if="error" class="error" role="alert">{{ error }}</p>
      <p v-if="state.planError" class="error" role="alert">{{ state.planError }} <button type="button" :disabled="!!operation" @click="retryPlan">重试计算轮次</button></p>
      <section v-if="state.planned" class="scorecard-section" aria-label="淘汰赛配置">
        <h4>淘汰赛配置（{{ state.groups.length }} 组）</h4>
        <p v-if="!state.groups.length">站位表中没有可用的淘汰赛分组。</p>
        <template v-else>
          <p>已填好 {{ readyGroups }} / {{ playable.length }} 组。请逐轮填写 1–99 的起止靶位，全部完成后可打包下载 ZIP。</p>
          <div class="group-search">
            <label class="group-search-field">搜索淘汰赛分组
              <input ref="searchInput" v-model="groupQuery" type="search" placeholder="例如：A组 30米 反曲弓 女子" :disabled="!!operation" @keydown.enter="locateGroup">
            </label>
            <button type="button" :disabled="!!operation || !groupQuery.trim()" @click="clearGroupSearch">清除搜索</button>
            <button type="button" :disabled="!!operation || !groupQuery.trim() || !visibleGroups.length" @click="locateGroup">定位首个结果</button>
            <p v-if="groupQuery.trim()" class="search-status" role="status">{{ visibleGroups.length ? '找到 ' + visibleGroups.length + ' 组' : '未找到匹配分组，请试试其他关键词。' }}</p>
          </div>
        </template>
        <article v-for="group in visibleGroups" :key="group.key" :ref="element => setGroupCard(group.key, element)" tabindex="-1" class="group" data-test="scorecard-group">
          <h5><span v-if="teamFormat(group)" class="format-label">{{ teamFormat(group) === 'team' ? '团体' : '混双' }}</span>{{ group.label }} · {{ group.participantCount }} {{ teamFormat(group) ? '队' : '人' }}</h5>
          <p v-if="group.participantCount < 2">不足 2 {{ teamFormat(group) ? '队' : '人' }}，无需生成淘汰赛手卡。</p>
          <p v-else-if="group.participantCount > 128" class="error">超过 128 {{ teamFormat(group) ? '队' : '人' }}，无法生成，请修正上传表格。</p>
          <template v-else>
            <div class="rounds">
              <fieldset v-for="round in group.rounds" :key="round.key" :class="{ 'main-round-start': round.key === '1/16' }" :disabled="!!operation">
                <legend>{{ round.label }}</legend>
                <div class="round-inputs">
                  <label>起始靶位<input :value="group.ranges[round.key][0]" :aria-label="round.label + '起始靶位'" type="number" min="1" max="99" step="1" inputmode="numeric" @input="setRange(group, round.key, 0, $event.target)"></label>
                  <label>结束靶位<input :value="group.ranges[round.key][1]" :aria-label="round.label + '结束靶位'" type="number" min="1" max="99" step="1" inputmode="numeric" @input="setRange(group, round.key, 1, $event.target)"></label>
                </div>
                <p class="hint" :class="{ error: rangeError(group, round) }">{{ rangeError(group, round) || countHint(round) }}</p>
              </fieldset>
            </div>
            <div class="actions">
              <button type="button" :disabled="!!operation || !validGroup(group)" @click="generateSingle(group)">生成本组 PDF</button>
              <a v-if="group.url" :href="group.url" :download="groupFilename(group)">下载 PDF</a>
            </div>
            <p v-if="group.error" class="error" role="alert">{{ group.error }}</p>
          </template>
        </article>
        <a v-if="state.zipUrl" :href="state.zipUrl" :download="zipFilename">下载全部 ZIP</a>
      </section>
    </div>
    <template #extra-actions>
      <button type="button" class="app-confirm-submit" :disabled="!!operation || !state.pages.length" @click="generateRanking">生成排位记分纸</button>
    </template>
  </AppConfirmDialog>
</template>

<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { dictionaryAPI, eventAPI } from '@/api'
import AppConfirmDialog from './AppConfirmDialog.vue'
import { createPdfUrl, pdfErrorMessage, releasePdfUrl, startPdfDownload } from '@/utils/scorecardDownload'
import { loadScorecardDraft, saveScorecardWorkbook, saveScorecardConfiguration } from '@/utils/scorecardDraftStorage'
import { filterScorecardGroups, indexScorecardDivisions, sortScorecardGroups } from '@/utils/scorecardGroupIndex'

const props = defineProps({ event: { type: Object, required: true }, state: { type: Object, required: true }, opener: { type: Object, default: null } })
const emit = defineEmits(['close'])
const state = props.state
const eventName = computed(() => props.event.year + '年' + props.event.season)
const zipFilename = computed(() => eventName.value + '_淘汰赛手卡.zip')
const open = ref(true)
const operation = ref('')
const error = ref('')
const groupQuery = ref('')
const divisionDictionary = ref([])
const searchInput = ref(null)
const groupCards = new Map()
let controller
let disposed = false

const GROUP_NAMES = { men: '男子组', women: '女子组', mixed: '混合组' }
const ROUND_KEYS = new Set(['1/64', '1/32', '1/16', '1/8', '1/4', '1/2', 'bronze', 'gold'])
const teamFormat = group => group.format === 'team' || group.format === 'mixed_team' ? group.format : undefined
const planKey = group => (teamFormat(group) || 'individual') + ':' + group.participantCount
const countHint = round => '需要 ' + round.target_counts.join(' 或 ') + ' 个靶位' +
  (round.target_counts[0] > 99 ? '（超出 1–99 的靶号范围）' : round.target_counts[1] > 99 ? '（后者超出 1–99，仅可共靶）' : '') + '。'
const validTarget = value => Number.isInteger(value) && value >= 1 && value <= 99
function rangeError(group, round) {
  const [start, end] = group.ranges[round.key]
  if (start === '' || end === '') return ''
  if (!validTarget(start) || !validTarget(end) || end < start) return '请填写 1–99 的升序靶位。' + countHint(round)
  const count = end - start + 1
  return round.target_counts.includes(count) ? '' : '当前共 ' + count + ' 个。' + countHint(round)
}
function validGroup(group) {
  return group.rounds.length > 0 && group.rounds.every(round => group.ranges[round.key].every(validTarget) && !rangeError(group, round))
}
const divisions = computed(() => indexScorecardDivisions(state.groups, divisionDictionary.value))
const sortedGroups = computed(() => sortScorecardGroups(state.groups, divisions.value))
const visibleGroups = computed(() => filterScorecardGroups(sortedGroups.value, groupQuery.value, divisions.value))
// Searching changes what is shown, not which groups are validated or exported.
const playable = computed(() => sortedGroups.value.filter(group => group.participantCount >= 2))
function setGroupCard(key, element) {
  if (element) groupCards.set(key, element)
  else groupCards.delete(key)
}
async function locateGroup(event) {
  if (event?.isComposing || event?.keyCode === 229) return
  event?.preventDefault()
  if (!groupQuery.value.trim() || operation.value) return
  await nextTick()
  const card = groupCards.get(visibleGroups.value[0]?.key)
  card?.focus({ preventScroll: true })
  card?.scrollIntoView?.({ block: 'nearest' })
}
function clearGroupSearch() {
  groupQuery.value = ''
  searchInput.value?.focus()
}
const readyGroups = computed(() => playable.value.filter(validGroup).length)
const canBatch = computed(() => state.planned && playable.value.length > 0 && readyGroups.value === playable.value.length)
function groupFilename(group) {
  const suffix = teamFormat(group) || GROUP_NAMES[group.genderGroup]
  const formatLabel = suffix === 'team' ? '团体' : suffix === 'mixed_team' ? '混双' : suffix
  const name = group.label.includes(formatLabel) ? group.label : group.label + '_' + formatLabel
  return (eventName.value + '_' + name + '_淘汰赛手卡.pdf').replace(/[<>:"/\\|?*]/g, '_')
}
function clearUrl(owner, key) {
  if (owner[key]) releasePdfUrl(owner[key])
  owner[key] = ''
}
function setRange(group, key, position, input) {
  if (operation.value) return
  const value = input.value === '' ? '' : input.valueAsNumber
  if (Object.is(group.ranges[key][position], value)) return
  group.ranges[key][position] = value
  clearUrl(group, 'url')
  group.pdf = null
  group.error = ''
  clearUrl(state, 'zipUrl')
  void persistDraft()
}

function snapshotConfiguration() {
  // Store the plain draft, not Vue proxies, transient errors, generated PDFs or their URLs.
  const groups = state.groups.map(({ key, format, bowType, distance, genderGroup, label, participantCount, fingerprint, rounds, ranges }) => ({
    key, format, bowType, distance, genderGroup, label, participantCount, fingerprint, rounds, ranges,
  }))
  return JSON.parse(JSON.stringify({ groups, planned: state.planned }))
}
async function persistDraft(includeWorkbook = !state.workbookSaved) {
  if (!state.file && !state.teamFile) return
  const attempt = ++state.saveRevision
  state.pendingSaves++
  try {
    const configuration = snapshotConfiguration()
    if (includeWorkbook) {
      const parsed = JSON.parse(JSON.stringify({ pages: state.pages, sourceGroups: state.sourceGroups, teamSourceGroups: state.teamSourceGroups }))
      await saveScorecardWorkbook(props.event.id, { ...parsed, file: state.file, teamFile: state.teamFile }, configuration)
      state.workbookSaved = true
    } else {
      await saveScorecardConfiguration(props.event.id, configuration)
    }
    if (attempt === state.saveRevision) state.storageError = ''
  } catch {
    if (attempt === state.saveRevision) state.storageError = '无法保存到当前浏览器，刷新可能丢失当前修改。'
  } finally {
    state.pendingSaves--
  }
}
async function restoreDraft() {
  if (!state.draftLoaded) {
    try {
      const draft = await loadScorecardDraft(props.event.id)
      if (disposed) return
      if (draft) {
        const { workbook, configuration } = draft
        state.file = workbook.file ?? null
        state.teamFile = workbook.teamFile ?? null
        state.pages = workbook.pages ?? []
        state.sourceGroups = workbook.sourceGroups ?? []
        state.teamSourceGroups = workbook.teamSourceGroups ?? []
        state.groups = (configuration?.groups ?? []).map(group => ({ ...group, pdf: null, url: '', error: '' }))
        state.planned = configuration?.planned === true
        state.workbookSaved = true
      }
    } catch {
      if (!disposed) state.storageError = '无法读取本地草稿，请重新选择站位表。'
    } finally {
      if (!disposed) state.draftLoaded = true
    }
  }
}

function readWorkbook(file) {
  if (typeof file.arrayBuffer === 'function') return file.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('无法读取站位表，请重新选择。'))
    reader.readAsArrayBuffer(file)
  })
}
async function run(label, work) {
  if (operation.value || disposed) return
  operation.value = label
  error.value = ''
  controller = new AbortController()
  try { await work(controller.signal) }
  catch (reason) {
    if (!disposed) {
      const message = await pdfErrorMessage(reason)
      if (!disposed) error.value = message
    }
  } finally {
    if (!disposed) operation.value = ''
    controller = undefined
  }
}
function checkedRounds(plan, count, format) {
  if (plan?.participant_count !== count || !Array.isArray(plan.rounds) || !plan.rounds.length ||
    new Set(plan.rounds.map(round => round?.key)).size !== plan.rounds.length || plan.rounds.some(round =>
      !ROUND_KEYS.has(round?.key) || typeof round.label !== 'string' || !Array.isArray(round.target_counts) ||
      round.target_counts.length !== (format ? 1 : 2) || !round.target_counts.every(n => Number.isInteger(n) && n >= 1 && n <= 128))) {
    throw new Error('轮次安排无效，请重试。')
  }
  return plan.rounds
}
async function planGroups(signal) {
  try {
    const sourceGroups = [...state.sourceGroups, ...state.teamSourceGroups]
    const plans = new Map()
    for (const group of sourceGroups) {
      const count = group.participantCount
      const key = planKey(group)
      if (count < 2 || count > 128 || plans.has(key)) continue
      const format = teamFormat(group)
      const plan = await eventAPI.eliminationRounds(props.event.id, count, signal, ...(format ? [format] : []))
      if (disposed) return
      plans.set(key, checkedRounds(plan, count, format))
    }
    const { reconcileScorecardGroups } = await import('@/utils/scorecardBatch')
    if (disposed) return
    const next = reconcileScorecardGroups(state.groups, sourceGroups.map(group => ({ ...group, rounds: plans.get(planKey(group)) ?? [] })))
    const kept = new Set(next.map(group => group.url).filter(Boolean))
    for (const group of state.groups) if (group.url && !kept.has(group.url)) releasePdfUrl(group.url)
    state.groups = next
    state.planned = true
    state.planError = ''
    await persistDraft()
  } catch (reason) {
    if (!disposed) state.planError = typeof reason?.detail === 'string' ? reason.detail : reason?.message || '淘汰赛轮次计算失败，请重试。'
  }
}
function retryPlan() {
  return run('正在重新计算轮次…', planGroups)
}
function chooseWorkbook(event, isTeam) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file) return
  const label = isTeam ? '团混队伍表' : '站位表'
  return run('正在解析' + label + '、计算轮次…', async signal => {
    if (!/\.xlsx$/i.test(file.name)) throw new Error('请选择 .xlsx 格式的' + label + '。')
    if (file.size > 10 * 1024 * 1024) throw new Error(label + '文件不能超过 10 MB。')
    const bytes = await readWorkbook(file)
    if (isTeam) {
      const { parseTeamScorecardGroups } = await import('@/utils/teamScorecardInput')
      if (disposed) return
      const groups = parseTeamScorecardGroups(bytes)
      if (!groups.length) throw new Error('没有识别到团体或混双队伍，请检查工作簿。')
      state.teamFile = file
      state.teamSourceGroups = groups
    } else {
      const { parseStationScorecards } = await import('@/utils/stationScorecardInput')
      if (disposed) return
      const parsed = parseStationScorecards(bytes)
      clearUrl(state, 'rankingUrl')
      state.file = file
      state.pages = parsed.pages
      state.sourceGroups = parsed.groups
    }
    clearUrl(state, 'zipUrl')
    state.planned = false
    state.planError = ''
    state.workbookSaved = false
    await persistDraft(true)
    if (!disposed) await planGroups(signal)
  })
}
function bestEffortDownload(url, filename) {
  try { startPdfDownload(url, filename) } catch { /* Keep the manual link when the browser blocks an automatic download. */ }
}
function generateRanking() {
  if (!state.pages.length) return
  return run('正在生成排位记分纸…', async signal => {
    const blob = await eventAPI.rankingScorecards(props.event.id, { pages: state.pages }, signal)
    if (disposed) return
    const url = createPdfUrl(blob)
    clearUrl(state, 'rankingUrl')
    state.rankingUrl = url
    bestEffortDownload(url, eventName.value + '_排位记分纸.pdf')
  })
}
async function getGroupPdf(group, signal) {
  if (group.pdf) return true
  group.error = ''
  try {
    const blob = await eventAPI.eliminationScorecards(props.event.id, {
      bow_type: group.bowType, distance: group.distance, gender_group: group.genderGroup,
      participant_count: group.participantCount,
      ...(teamFormat(group) ? { competition_format: teamFormat(group) } : {}),
      ranges: Object.fromEntries(group.rounds.map(round => [round.key, [...group.ranges[round.key]]])),
    }, signal)
    if (disposed) return false
    group.url = createPdfUrl(blob)
    group.pdf = blob
    return true
  } catch (reason) {
    if (!disposed) {
      const message = await pdfErrorMessage(reason)
      if (!disposed) group.error = message
    }
    return false
  }
}
function generateSingle(group) {
  if (!state.planned || !validGroup(group)) return
  return run('正在生成 ' + group.label + ' 手卡…', async signal => {
    if (await getGroupPdf(group, signal) && !disposed) bestEffortDownload(group.url, groupFilename(group))
  })
}
function generateBatch() {
  if (!canBatch.value) return
  return run('正在生成淘汰赛手卡…', async signal => {
    if (state.zipUrl) { bestEffortDownload(state.zipUrl, zipFilename.value); return }
    const groups = playable.value
    const entries = []
    for (const [index, group] of groups.entries()) {
      if (disposed) return
      operation.value = '正在处理淘汰赛手卡 ' + (index + 1) + ' / ' + groups.length + '：' + group.label
      if (await getGroupPdf(group, signal)) entries.push({ name: groupFilename(group), blob: group.pdf })
    }
    if (disposed) return
    if (entries.length !== groups.length) throw new Error('有分组生成失败。成功的 PDF 可以单独下载；请重试后下载全部 ZIP。')
    operation.value = '正在打包全部淘汰赛手卡…'
    const { buildScorecardZip } = await import('@/utils/scorecardBatch')
    const blob = await buildScorecardZip(entries)
    if (disposed) return
    state.zipUrl = URL.createObjectURL(blob)
    bestEffortDownload(state.zipUrl, zipFilename.value)
  })
}
async function close() {
  if (operation.value || !open.value) return
  open.value = false
  await nextTick()
  if (!disposed) emit('close')
}
async function loadDivisionDictionary(signal) {
  try {
    const response = await dictionaryAPI.getAll(signal)
    if (!disposed && Array.isArray(response?.data?.competitionGroups)) divisionDictionary.value = response.data.competitionGroups
  } catch {
    // Explicit workbook groups still sort correctly if the dictionary is unavailable.
  }
}
onMounted(() => {
  void run('正在加载组别及本地草稿…', async signal => {
    await Promise.all([restoreDraft(), loadDivisionDictionary(signal)])
    if (!disposed && (state.file || state.teamFile) && !state.planned) await planGroups(signal)
  })
})
onBeforeUnmount(() => { disposed = true; controller?.abort() })
</script>

<style scoped>
.scorecard-content { display: grid; align-content: start; flex: 1; min-height: 0; overflow-y: auto; gap: 12px; padding: 2px 6px; color: #333; font-size: 14px; }
.scorecard-section, .group { display: grid; gap: 8px; }
.scorecard-content p, .scorecard-content h4, .scorecard-content h5 { margin: 0; }
.workbook-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 10px; align-items: start; }
.workbook { display: grid; gap: 6px; min-width: 0; }
.workbook input { max-width: 100%; }
.format-label { display: inline-block; margin-right: 7px; padding: 1px 5px; border-radius: 4px; background: #eef2ff; color: #253c81; font-size: 12px; }
.group { container: scorecard-group / inline-size; border: 1px solid #dce2f0; border-radius: 8px; padding: 10px; }
.group h5 { font-size: 15px; }
.group:focus { outline: 2px solid #335fcc; outline-offset: -2px; }
.group-search { display: flex; flex-wrap: wrap; align-items: end; gap: 8px; padding: 10px; border: 1px solid #dce2f0; border-radius: 8px; background: #f5f7fd; }
.group-search-field { display: grid; flex: 1 1 210px; gap: 4px; min-width: 0; font-weight: 600; }
.group-search-field input { box-sizing: border-box; min-width: 0; padding: 6px 8px; border: 1px solid #8292ae; border-radius: 5px; background: #fff; font-size: 16px; }
.group-search .search-status { flex-basis: 100%; color: #4a5b77; font-size: 12px; }
.rounds { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 8px; }
.main-round-start { grid-column-start: 1; }
.rounds fieldset { min-width: 0; margin: 0; padding: 6px 8px 8px; border: 1px solid #e4e7f1; border-radius: 6px; }
.rounds legend { padding: 0 4px; font-weight: 600; }
.round-inputs { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 52px), 1fr)); gap: 6px; }
.round-inputs label { display: grid; gap: 3px; min-width: 0; font-size: 12px; }
.round-inputs input {
  width: 100%; min-width: 0; min-height: 34px; box-sizing: border-box;
  padding: 5px 6px; border: 1px solid #8292ae; border-radius: 5px;
  background: #f5f7fd; color: #1d2b47; font-size: 16px;
}
.round-inputs input:focus { border-color: #335fcc; outline: 2px solid #335fcc; outline-offset: 1px; background: #fff; }
.round-inputs input:disabled { opacity: .65; }
@container scorecard-group (max-width: 620px) { .rounds { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
@container scorecard-group (max-width: 400px) { .rounds { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.scorecard-content button { border: 1px solid #b8c6ee; border-radius: 5px; padding: 6px 10px; background: #eef2ff; color: #253c81; cursor: pointer; }
.scorecard-content button:disabled { opacity: .55; cursor: not-allowed; }
.scorecard-content a { color: #294fb5; }
.progress { position: sticky; top: 0; z-index: 1; padding: 6px; background: #eef2ff; border-radius: 5px; }
.rounds .hint { margin-top: 5px; font-size: 12px; color: #555; }
.storage-note { font-size: 12px; color: #555; }
.error, .rounds .hint.error { color: #a02e29; }
</style>
