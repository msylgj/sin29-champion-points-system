<template>
  <main class="scoring-rules-page safe-area">
    <header class="page-header rules-header">
      <div class="header-top">
        <button type="button" class="btn-back" title="返回赛事清单" :disabled="busy" @click="!busy && returnToList()">← 返回</button>
        <div class="header-title-wrap">
          <h1>积分规则管理</h1>
          <p class="subtitle">查看历史规则，创建并保存新的积分规则</p>
        </div>
        <span class="header-spacer" aria-hidden="true"></span>
      </div>
    </header>
    <div class="rules-container">

      <div v-if="deleteError" class="failure-notice" data-test="delete-error" role="alert">
        <div><strong>删除失败：{{ deleteError }}</strong><p>请刷新版本列表确认当前规则后再操作。</p></div>
        <button type="button" class="btn-retry-inline" :disabled="loading || busy" @click="loadRules">刷新版本列表</button>
      </div>
      <div v-if="rulesError" class="failure-notice" role="alert"><div><strong>规则加载失败：{{ rulesError }}</strong><p>请重试加载规则版本。</p></div><button type="button" class="btn-retry-inline" :disabled="loading || busy" @click="loadRules">重试加载规则</button></div>
      <div v-if="eventsError" class="failure-notice" role="alert"><div><strong>赛事加载失败：{{ eventsError }}</strong><p>请重试加载可选截止赛事。</p></div><button type="button" class="btn-retry-inline" :disabled="eventsLoading || busy" @click="loadEvents">重试加载赛事</button></div>
      <p v-if="dictionaryError" class="empty-tip">字典加载失败，暂显示原始代码；继承快照不受影响。<button type="button" :disabled="busy" @click="loadDictionaries">重试字典</button></p>
      <p v-if="loading || eventsLoading" role="status">正在加载规则与赛事…</p>
      <p v-else-if="!eventsError && !events.length" class="empty-tip">暂无赛事，无法指定前版截止赛事；请先在赛事配置中创建赛事。</p>
      <p v-if="!eventsLoading && !eventsError && events.length && !eligibleEvents.length" class="empty-tip">没有可用截止赛事：已有赛事均早于最新规则的起始赛季，请先创建新的赛事。</p>
      <p v-if="conflict && !draft && !reloadedAfterConflict" class="empty-tip">版本冲突：请先刷新版本列表，再继承最新规则。</p>
      <section class="rules-panel" aria-label="规则版本">
        <div class="section-heading">
          <h2>规则版本</h2>
          <div class="section-actions">
            <button type="button" data-test="reload-rules" :disabled="loading || busy" @click="loadRules">刷新版本列表</button>
            <button type="button" class="btn-primary" data-test="create-rule" :disabled="!canCreate" @click="startDraft">创建新规则</button>
          </div>
        </div>
        <p v-if="!loading && !rulesError && !rules.length">暂无规则，请联系管理员检查初始规则是否已生成。</p>
        <div v-else class="table-scroll table-wrapper manage-table-wrap"><table class="manage-table"><thead><tr><th>版本</th><th>名称</th><th>生效区间（含截止赛季）</th><th>来源</th><th>操作</th></tr></thead>
          <tbody><tr v-for="rule in rules" :key="rule.id" :class="{ selected: selectedRuleId === rule.id }">
            <td>#{{ rule.id }} <strong v-if="rule.id === latest?.id">最新</strong></td><td>{{ rule.name }}</td>
            <td>{{ rule.start ? seasonLabel(rule.start) : '最初' }} — {{ rule.end ? seasonLabel(rule.end) : '持续生效' }}</td>
            <td>{{ rule.source_rule_id ? '#' + rule.source_rule_id : '初始快照' }}</td>
            <td class="action-cell">
              <button type="button" class="btn-row-save" :disabled="busy || !!draft" :aria-label="'查看规则' + rule.id" @click="!busy && (selectedRuleId = rule.id)">查看</button>
              <button v-if="rule.id === latest?.id" type="button" class="btn-delete btn-row-delete" data-test="delete-rule" :disabled="!canDelete" :title="rule.source_rule_id === null ? '初始规则不可删除' : '删除最新规则并恢复上一版持续生效'" :aria-busy="deleting" @click="deleteLatestRule">删除</button>
            </td>
          </tr></tbody></table></div>
      </section>
      <section v-if="selectedRule || draft" class="rules-panel" :class="{ 'draft-panel': !!draft }" :data-test="draft ? 'rule-draft' : 'rule-history'">
        <template v-if="!draft">
          <h2>{{ selectedRule.name }} · #{{ selectedRule.id }}</h2>
          <p>创建时间：{{ selectedRule.created_at || '—' }}。已发布配置不可修改，只能继承最新版本创建后继。</p>
          <ScoringRuleConfig :config="selectedRule.config" readonly :bow-types="bowTypes" :distances="distances" />
        </template>
        <template v-else>
          <h2>创建新规则</h2>
          <p>继承版本 #{{ draft.base_rule_id }}，请直接编辑下方规则配置，完成后保存。已有版本不会被覆盖。</p>
          <div v-if="staleDraft" role="alert" class="empty-tip">最新版本已变化，草稿已保留，禁止直接提交。请先重载版本列表，再从最新版本重新继承并核对修改。
            <button type="button" :disabled="loading || busy" @click="loadRules">重载版本列表（保留草稿）</button>
          </div>
          <div v-if="submitError" class="failure-notice" role="alert"><div><strong>规则未保存</strong><p>{{ submitError }}</p></div></div>
          <form novalidate @submit.prevent="saveDraft">
            <fieldset :disabled="busy" class="draft-basics">
              <legend>版本信息</legend>
              <label for="rule-name">规则名称 *<input class="manage-search-input" id="rule-name" v-model.trim="draft.name" maxlength="100" required /></label>
              <label for="rule-end-event">前版截止赛事（含该赛季） *
                <select class="manage-filter-select" id="rule-end-event" v-model="draft.previous_end_event_id" required>
                  <option value="">请选择截止赛季</option>
                  <option v-for="event in eligibleEvents" :key="event.id" :value="event.id">{{ seasonLabel(event) }}</option>
                </select>
              </label>
              <p v-if="!eligibleEvents.length" class="empty-tip">没有可用截止赛事（截止不能早于最新版本起始赛季）。</p>
              <p class="start-preview" data-test="start-preview" aria-live="polite">
                <template v-if="selectedEndEvent">新版起始赛季：{{ seasonLabel(nextSeason(selectedEndEvent)) }}（前版适用至{{ seasonLabel(selectedEndEvent) }}，含该赛季）</template>
                <template v-else>请选择截止赛季</template>
              </p>
            </fieldset>
            <ScoringRuleConfig :config="draft.config" :disabled="busy" :bow-types="bowTypes" :distances="distances" />
            <p class="empty-tip">所选截止赛事之后，包括已有赛事，将按新规则重算；已保存版本配置不可编辑。以后调整只能再创建后继版本。</p>
            <div class="draft-actions"><button type="submit" class="btn-primary" data-test="save-rule" :disabled="busy || staleDraft || loading || eventsLoading || !!rulesError || !!eventsError || !eligibleEvents.length">{{ saving ? '正在保存…' : '保存规则' }}</button><button type="button" :disabled="busy" @click="cancelDraft">取消编辑</button></div>
          </form>
        </template>
      </section>
    </div>
    <AppFeedback :success="pageMsg.successMsg.value" :error="pageMsg.errorMsg.value" />
    <AppConfirmDialog :open="!!confirmation" :title="confirmation?.title || ''" :message="confirmation?.message || ''" :confirm-text="confirmation?.confirmText || '确认'" :danger="!!confirmation?.danger" :return-focus="confirmation?.returnFocus || null" @confirm="settleConfirmation(true)" @cancel="settleConfirmation(false)" />
  </main>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, scoringRuleAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { cloneRuleConfig, loadAllRuleEvents, nextSeason, normalizeRuleConfig, ruleErrorMessage, seasonIndex, seasonLabel, validateRuleConfig } from '@/utils/scoringRules'
import ScoringRuleConfig from './ScoringRuleConfig.vue'
import { useMessage } from '@/composables/useMessage'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import AppFeedback from '@/components/AppFeedback.vue'

const router = useRouter()
const rules = ref([])
const events = ref([])
const selectedRuleId = ref(null)
const loading = ref(false)
const eventsLoading = ref(false)
const saving = ref(false)
const deleting = ref(false)
const deleteError = ref('')
const deleteNeedsRefresh = ref(false)
const rulesError = ref('')
const eventsError = ref('')
const dictionaryError = ref(false)
const submitError = ref('')
const pageMsg = useMessage(5000)
async function returnToList() {
  if (disposed) return
  try {
    if (await router.push('/event-list') && !disposed) pageMsg.show('error', '未能返回赛事清单，请重试。')
  } catch {
    if (!disposed) pageMsg.show('error', '未能返回赛事清单，请重试。')
  }
}
const confirmation = ref(null)
let confirmationResolver = null
let disposed = false
const busy = computed(() => saving.value || deleting.value || !!confirmation.value)
const askConfirmation = options => {
  if (disposed || busy.value) return Promise.resolve(false)
  // Capture before busy disables the trigger; browsers may blur it during patching.
  confirmation.value = { ...options, returnFocus: document.activeElement }
  return new Promise(resolve => { confirmationResolver = resolve })
}
const settleConfirmation = accepted => {
  const resolve = confirmationResolver
  confirmationResolver = null
  confirmation.value = null
  resolve?.(accepted)
}
onUnmounted(() => { disposed = true; settleConfirmation(false) })
const draft = ref(null)
const conflict = ref(false)
const reloadedAfterConflict = ref(false)
const { bowTypes, distances, loadDictionaries: fetchDictionaries } = useDictionaries()
const latest = computed(() => rules.value[0] || null)
const selectedRule = computed(() => rules.value.find(rule => rule.id === selectedRuleId.value))
const staleDraft = computed(() => !!draft.value && (conflict.value || draft.value.base_rule_id !== latest.value?.id))
const eligibleEvents = computed(() => events.value.filter(event => nextSeason(event) && (!latest.value?.start || seasonIndex(event) >= seasonIndex(latest.value.start))))
const selectedEndEvent = computed(() => eligibleEvents.value.find(event => String(event.id) === String(draft.value?.previous_end_event_id)))
const canCreate = computed(() => !!latest.value && !!eligibleEvents.value.length && !loading.value && !eventsLoading.value && !busy.value && !deleteNeedsRefresh.value && !rulesError.value && !eventsError.value && (!conflict.value || reloadedAfterConflict.value))

const canDelete = computed(() => !!latest.value && latest.value.source_rule_id !== null && !draft.value && !busy.value && !loading.value && !eventsLoading.value && !rulesError.value && !deleteNeedsRefresh.value && (!conflict.value || reloadedAfterConflict.value))

const deleteLatestRule = async () => {
  if (!canDelete.value) return
  const target = latest.value
  if (!(await askConfirmation({ title: '删除规则', confirmText: '确认删除', danger: true, message: '确定删除规则“' + target.name + '”（#' + target.id + '）？删除后上一版将恢复持续生效；原适用赛事及后续积分将按上一版规则重算。此操作不可撤销。' }))) return
  if (!canDelete.value || latest.value?.id !== target.id) return
  deleting.value = true
  deleteError.value = ''
  pageMsg.clear()
  try {
    const { deleted_rule_id, restored_rule } = await scoringRuleAPI.delete(target.id)
    if (deleted_rule_id !== target.id || restored_rule?.id !== target.source_rule_id) throw new Error('删除响应不完整')
    rules.value = [restored_rule, ...rules.value.filter(rule => rule.id !== deleted_rule_id && rule.id !== restored_rule.id)]
    selectedRuleId.value = restored_rule.id
    conflict.value = false
    reloadedAfterConflict.value = false
    if (!disposed) pageMsg.show('success', '规则已删除；上一版“' + restored_rule.name + '”（#' + restored_rule.id + '）已恢复持续生效，原适用赛事及后续积分将按上一版规则重算。')
    await returnToList()
  } catch (error) {
    deleteError.value = ruleErrorMessage(error)
    if (!disposed) pageMsg.show('error', deleteError.value)
    // A failed or lost response can leave the displayed timeline stale. Require
    // a fresh snapshot before any further publish/delete action, including 404.
    deleteNeedsRefresh.value = true
  } finally { deleting.value = false }
}

const loadRules = async () => {
  if (loading.value || busy.value) return
  loading.value = true
  rulesError.value = ''
  try {
    const response = await scoringRuleAPI.getList()
    rules.value = response.items || []
    deleteError.value = ''
    deleteNeedsRefresh.value = false
    if (conflict.value) reloadedAfterConflict.value = true
    if (!rules.value.some(rule => rule.id === selectedRuleId.value)) selectedRuleId.value = latest.value?.id || null
  } catch (error) { rulesError.value = ruleErrorMessage(error) } finally { loading.value = false }
}
const loadEvents = async () => {
  if (eventsLoading.value || busy.value) return
  eventsLoading.value = true
  eventsError.value = ''
  try { events.value = await loadAllRuleEvents(eventAPI) } catch (error) { eventsError.value = ruleErrorMessage(error) } finally { eventsLoading.value = false }
}
const loadDictionaries = async () => {
  if (busy.value) return
  dictionaryError.value = false
  try { await fetchDictionaries() } catch { dictionaryError.value = true }
}
const startDraft = async () => {
  if (!canCreate.value) return
  if (draft.value && !(await askConfirmation({ title: '创建新规则', confirmText: '重新继承', message: '重新继承将替换当前草稿，未保存的修改将丢失。是否继续？' }))) return
  if (!canCreate.value) return
  selectedRuleId.value = latest.value.id
  draft.value = { name: '', base_rule_id: latest.value.id, previous_end_event_id: '', config: cloneRuleConfig(latest.value.config) }
  conflict.value = false
  reloadedAfterConflict.value = false
  submitError.value = ''
  pageMsg.clear()
}
const cancelDraft = async () => {
  if (busy.value || !draft.value) return
  if (await askConfirmation({ title: '取消编辑', confirmText: '放弃修改', message: '确定放弃当前草稿？未保存的修改将丢失。' })) { draft.value = null; submitError.value = ''; pageMsg.clear() }
}
const saveDraft = async () => {
  if (busy.value || !draft.value || staleDraft.value || !canCreate.value) return
  pageMsg.clear()
  submitError.value = ''
  if (!draft.value.name.trim()) { submitError.value = '请填写规则名称'; pageMsg.show('error', submitError.value); return }
  if (!selectedEndEvent.value) { submitError.value = '请选择前版截止赛事'; pageMsg.show('error', submitError.value); return }
  const validation = validateRuleConfig(draft.value.config)
  if (validation) { submitError.value = validation; pageMsg.show('error', validation); return }
  if (!(await askConfirmation({ title: '保存新规则', confirmText: '确认保存', message: '所选截止赛事之后，包括已有赛事，将按新规则重算；已保存版本配置不可编辑。前版含截止赛季，新版从下一赛季起生效。确认保存？' }))) return
  if (disposed || !draft.value || staleDraft.value || !canCreate.value || !selectedEndEvent.value) return
  const payload = { ...draft.value, name: draft.value.name.trim(), previous_end_event_id: selectedEndEvent.value.id, config: normalizeRuleConfig(draft.value.config) }
  const end = { year: selectedEndEvent.value.year, season: selectedEndEvent.value.season }
  saving.value = true
  try {
    const created = await scoringRuleAPI.create(payload)
    rules.value = [created, ...rules.value.map(rule => rule.id === payload.base_rule_id ? { ...rule, end } : rule)]
    selectedRuleId.value = created.id
    draft.value = null
    if (!disposed) pageMsg.show('success', '新规则已保存；历史规则保持只读。')
    await returnToList()
  } catch (error) {
    if ((error.status || error.response?.status) === 409) { conflict.value = true; reloadedAfterConflict.value = false }
    submitError.value = ruleErrorMessage(error)
    if (!disposed) pageMsg.show('error', submitError.value)
  } finally { saving.value = false }
}
onMounted(() => { loadRules(); loadEvents(); loadDictionaries() })
</script>

<style scoped lang="scss" src="@/styles/ScoringRules.scss" />
