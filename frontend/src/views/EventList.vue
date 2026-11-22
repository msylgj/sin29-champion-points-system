<template>
  <main class="event-list-page safe-area">
    <header class="page-header">
      <div class="header-top">
        <button type="button" class="btn-back" title="返回积分排名" @click="router.push('/points-display')">← 返回</button>
        <div class="header-title-wrap">
          <h1>赛事清单</h1>
          <p class="subtitle">按赛年和赛季查看并管理赛事</p>
        </div>
        <span class="header-spacer" aria-hidden="true"></span>
      </div>
    </header>

    <section class="event-list-panel" aria-label="赛事管理">
      <div class="list-actions">
        <button ref="createButton" type="button" class="btn-primary" @click="router.push('/event-add')">创建赛事</button>
        <button type="button" class="btn-secondary" @click="router.push('/work-wizard')">进入向导</button>
        <button type="button" class="btn-secondary" @click="router.push('/scoring-rules')">积分规则配置</button>
      </div>
      <p class="section-help">报名人数按报名记录计，同一选手参加不同项目时分别计入。</p>
      <p v-if="deletedName" class="empty-tip" role="status">已删除「{{ deletedName }}」及其关联记录。</p>
      <p v-if="loading" class="empty-tip" role="status">正在加载赛事清单…</p>
      <div v-else-if="error" class="failure-notice" role="alert">
        <div><strong>无法加载赛事清单</strong><p>{{ error }}</p></div>
        <button type="button" class="btn-retry-inline" @click="loadEvents(page)">重试</button>
      </div>
      <p v-else-if="!events.length" class="empty-tip">暂无赛事，可点击「创建赛事」或「进入向导」。</p>
      <template v-else>
        <div class="table-wrapper">
          <table class="manage-table">
            <thead><tr><th scope="col">赛事名称</th><th scope="col">报名人数</th><th scope="col">成绩条数</th><th scope="col">操作</th></tr></thead>
            <tbody>
              <tr v-for="event in events" :key="event.id">
                <th scope="row" class="event-name">{{ eventName(event) }}</th>
                <td>{{ event.registration_count }}</td>
                <td>{{ event.score_count }}</td>
                <td>
                  <div class="row-actions">
                    <button type="button" class="btn-secondary" @click="openEvent('/event-add', event.id)">修改赛事配置</button>
                    <button type="button" class="btn-primary" @click="openEvent('/score-import', event.id)">导入成绩</button>
                    <button type="button" class="btn-secondary" :aria-label="'生成' + eventName(event) + '记分纸'" @click="openScorecard(event, $event.currentTarget)">生成记分纸</button>
                    <button type="button" class="btn-delete" :aria-label="'删除' + eventName(event)" @click="askDelete(event, $event.currentTarget)">删除</button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <nav v-if="totalPages > 1" class="pagination" aria-label="赛事清单分页">
          <button type="button" class="btn-secondary" :disabled="page === 1" @click="loadEvents(page - 1)">上一页</button>
          <span>第 {{ page }} / {{ totalPages }} 页 · 共 {{ total }} 场</span>
          <button type="button" class="btn-secondary" :disabled="page >= totalPages" @click="loadEvents(page + 1)">下一页</button>
        </nav>
      </template>
    </section>
    <ScorecardDialog v-if="scorecard" :event="scorecard.event"
      :state="getScorecardState(scorecard.event.id)" :opener="scorecard.opener" @close="scorecard = null" />
    <AppConfirmDialog :open="!!deleteTarget" title="删除赛事"
      :message="deleteTarget ? '删除赛事将同步清理对应的报名信息、成绩和赛事配置，且无法撤销。是否确定要删除「' + deleteTarget.name + '」？' : ''"
      confirm-text="确定" danger :busy="deleting" :confirm-disabled="!canDelete"
      :return-focus="deleteTarget?.opener" :fallback-focus="createButton"
      @confirm="confirmDelete" @cancel="cancelDelete">
      <div v-if="deleteTarget" class="delete-confirmation">
        <p>赛事名称（可复制）：<strong class="event-name" data-test="delete-event-name">{{ deleteTarget.name }}</strong></p>
        <label>
          输入完整赛事名称以确认删除
          <input v-model="typedName" type="text" autocomplete="off" :disabled="deleting" data-test="delete-name-input">
        </label>
        <p v-if="deleteError" class="delete-error" role="alert">{{ deleteError }}</p>
      </div>
    </AppConfirmDialog>
  </main>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI } from '@/api'
import AppConfirmDialog from '@/components/AppConfirmDialog.vue'
import ScorecardDialog from '@/components/ScorecardDialog.vue'
import { releasePdfUrl } from '@/utils/scorecardDownload'
import { deleteScorecardDraft } from '@/utils/scorecardDraftStorage'

const router = useRouter()
const pageSize = 20
const page = ref(1)
const total = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize)))
const events = ref([])
const loading = ref(false)
const error = ref('')
const createButton = ref(null)
const scorecard = ref(null)
const scorecardStates = new Map()
const deleteTarget = ref(null)
const typedName = ref('')
const deleting = ref(false)
const deleteError = ref('')
const deletedName = ref('')
const canDelete = computed(() => !!deleteTarget.value && typedName.value === deleteTarget.value.name)
let disposed = false

const eventName = event => event.year + '年' + event.season
function openScorecard(event, opener) {
  if (deleteTarget.value || scorecard.value || loading.value) return
  scorecard.value = { event, opener }
}

function getScorecardState(eventId) {
  if (!scorecardStates.has(eventId)) {
    scorecardStates.set(eventId, reactive({
      file: null, pages: [], sourceGroups: [], groups: [], planned: false, planError: '', rankingUrl: '', zipUrl: '',
      draftLoaded: false, workbookSaved: false, pendingSaves: 0, storageError: '', saveRevision: 0,
    }))
  }
  return scorecardStates.get(eventId)
}

function discardScorecardState(eventId) {
  const state = scorecardStates.get(eventId)
  if (!state) return
  for (const url of [state.rankingUrl, state.zipUrl, ...state.groups.map(group => group.url)]) {
    if (url) releasePdfUrl(url)
  }
  scorecardStates.delete(eventId)
}

function askDelete(event, opener) {
  if (deleteTarget.value || scorecard.value || deleting.value || loading.value) return
  typedName.value = ''
  deleteError.value = ''
  deletedName.value = ''
  deleteTarget.value = { id: event.id, name: eventName(event), opener }
}

function cancelDelete() {
  if (!deleting.value) deleteTarget.value = null
}

async function confirmDelete() {
  if (!canDelete.value || deleting.value) return
  const { id, name } = deleteTarget.value
  deleting.value = true
  deleteError.value = ''
  try {
    await eventAPI.delete(id, typedName.value)
  } catch (reason) {
    if (!disposed) deleteError.value = typeof reason?.detail === 'string' ? reason.detail : '删除请求失败，请重试。'
    return
  } finally {
    deleting.value = false
  }
  // The server deletion succeeded; only then remove the matching browser draft.
  void deleteScorecardDraft(id).catch(() => {})
  if (disposed) return
  discardScorecardState(id)
  events.value = events.value.filter(event => event.id !== id)
  deleteTarget.value = null
  deletedName.value = name
  await loadEvents(page.value)
}

async function loadEvents(targetPage) {
  if (loading.value) return
  page.value = targetPage
  loading.value = true
  error.value = ''
  try {
    const result = await eventAPI.getList({ summary: true, page: targetPage, page_size: pageSize })
    if (!Array.isArray(result?.items) || !Number.isSafeInteger(result.total) || result.total < 0 ||
        result.items.some(event => !Number.isSafeInteger(event?.id) || event.id <= 0 ||
          ![event.registration_count, event.score_count].every(count => Number.isSafeInteger(count) && count >= 0))) {
      throw new Error('赛事清单响应不完整，请重试。')
    }
    total.value = result.total
    events.value = result.items
  } catch (reason) {
    error.value = typeof reason?.detail === 'string' ? reason.detail : reason?.message || '请稍后重试。'
  } finally {
    loading.value = false
  }
  if (!error.value && page.value > totalPages.value) await loadEvents(totalPages.value)
}

const openEvent = (path, id) => router.push({ path, query: { event_id: String(id) } })
onMounted(() => loadEvents(1))
onBeforeUnmount(() => {
  disposed = true
  for (const eventId of scorecardStates.keys()) discardScorecardState(eventId)
})
</script>

<style scoped lang="scss" src="@/styles/EventList.scss" />
