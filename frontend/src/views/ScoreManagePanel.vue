<template>
  <div class="section">
    <h2 class="section-title">成绩管理</h2>
    <p class="section-help">仅支持查看和编辑当前赛事已有成绩，不支持新增。</p>

    <div v-if="loading" class="empty-tip">成绩加载中...</div>
    <div v-else-if="scores.length === 0" class="empty-tip">当前赛事暂无成绩</div>
    <div v-else>
      <div class="bow-tabs">
        <button
          v-for="tab in bowTabs"
          :key="tab.code"
          type="button"
          class="bow-tab"
          :class="{ active: tab.code === activeBowType }"
          @click="activeBowType = tab.code"
        >
          {{ tab.name }}
        </button>
      </div>

      <div class="manage-tools">
        <div class="manage-tool-left">
          <input
            v-model="nameKeyword"
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
            :disabled="batchSaving || modifiedCount === 0"
            @click="saveAllModified"
          >
            {{ batchSaving ? '批量保存中...' : `保存当前弓种修改 (${modifiedCount})` }}
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
            <tr v-for="score in filteredScores" :key="score.id" :class="{ 'row-modified': isRowChanged(score), 'row-deleted': deletedIds.has(score.id) }">
              <td>{{ score.id }}</td>
              <td><input v-model="score.name" class="cell-input" type="text" :disabled="deletedIds.has(score.id)" /></td>
              <td><input v-model="score.club" class="cell-input" type="text" :disabled="deletedIds.has(score.id)" /></td>
              <td>
                <select v-model="score.bow_type" class="cell-input" :disabled="deletedIds.has(score.id)">
                  <option v-for="item in bowTypes" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td>
                <select v-model="score.distance" class="cell-input" :disabled="deletedIds.has(score.id)">
                  <option v-for="item in distances" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td>
                <select v-model="score.format" class="cell-input" :disabled="deletedIds.has(score.id)">
                  <option v-for="item in competitionFormats" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td><input v-model.number="score.rank" class="cell-input" type="number" min="1" :disabled="deletedIds.has(score.id)" /></td>
              <td class="action-cell">
                <template v-if="deletedIds.has(score.id)">
                  <button type="button" class="btn-row-delete-confirm" :disabled="savingIds.has(score.id)" @click="confirmDeleteScore(score.id)">
                    {{ savingIds.has(score.id) ? '删除中...' : '确认删除' }}
                  </button>
                  <button type="button" class="btn-row-reset" :disabled="savingIds.has(score.id)" @click="resetScore(score.id)">
                    撤销
                  </button>
                </template>
                <template v-else>
                  <button type="button" class="btn-row-save" :disabled="savingIds.has(score.id)" @click="saveScore(score)">
                    {{ savingIds.has(score.id) ? '保存中...' : '保存' }}
                  </button>
                  <button type="button" class="btn-row-reset" :disabled="savingIds.has(score.id)" @click="resetScore(score.id)">
                    重置
                  </button>
                  <button type="button" class="btn-row-delete" :disabled="savingIds.has(score.id)" @click="markDelete(score.id)">
                    删除
                  </button>
                </template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div v-if="manageMsg.successMsg.value" class="success-message">
      {{ manageMsg.successMsg.value }}
    </div>
    <div v-if="manageMsg.errorMsg.value" class="error-message">
      {{ manageMsg.errorMsg.value }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { scoreAPI } from '@/api'
import { useMessage } from '@/composables/useMessage'

const props = defineProps({
  scores: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  bowTypes: { type: Array, required: true },
  distances: { type: Array, required: true },
  competitionFormats: { type: Array, required: true }
})

const manageMsg = useMessage()

const activeBowType = ref('')
const originalMap = ref({})
const savingIds = ref(new Set())
const deletedIds = ref(new Set())
const showModifiedOnly = ref(false)
const batchSaving = ref(false)
const nameKeyword = ref('')

const snapshot = () => {
  const map = {}
  props.scores.forEach(item => {
    map[item.id] = { ...item }
  })
  originalMap.value = map
}

const normalize = (score = {}) => ({
  name: (score.name || '').trim(),
  club: (score.club || '').trim(),
  bow_type: score.bow_type || '',
  distance: score.distance || '',
  format: score.format || '',
  rank: Number(score.rank || 0)
})

const isModified = (score) => {
  const original = originalMap.value[score.id]
  if (!original) return false
  const a = normalize(score)
  const b = normalize(original)
  return ['name', 'club', 'bow_type', 'distance', 'format', 'rank'].some(k => a[k] !== b[k])
}

const isRowChanged = (score) => {
  return deletedIds.value.has(score.id) || isModified(score)
}

const bowTabs = computed(() => {
  const bowSet = new Set((props.scores || []).map(item => item.bow_type))
  return props.bowTypes.filter(item => bowSet.has(item.code))
})

watch(() => props.scores, () => {
  snapshot()
  deletedIds.value = new Set()
  const tabs = bowTabs.value
  if (tabs.length > 0) {
    const hasCurrent = tabs.some(item => item.code === activeBowType.value)
    activeBowType.value = hasCurrent ? activeBowType.value : tabs[0].code
  } else {
    activeBowType.value = ''
  }
}, { immediate: true })

const currentTabScores = computed(() => {
  if (!activeBowType.value) return []
  return props.scores.filter(item => item.bow_type === activeBowType.value)
})

const modifiedCount = computed(() => {
  return currentTabScores.value.filter(item => isRowChanged(item)).length
})

const filteredScores = computed(() => {
  if (!activeBowType.value) return []
  const keyword = (nameKeyword.value || '').trim().toLowerCase()
  const list = props.scores.filter(item => {
    if (item.bow_type !== activeBowType.value) return false
    if (showModifiedOnly.value && !isRowChanged(item)) return false
    if (keyword && !(item.name || '').toLowerCase().includes(keyword)) return false
    return true
  })

  return [...list].sort((a, b) => {
    const parseDistance = (v) => {
      const m = String(v || '').match(/\d+/)
      return m ? Number(m[0]) : 0
    }
    const byDist = parseDistance(b.distance) - parseDistance(a.distance)
    if (byDist !== 0) return byDist
    const byFmt = (a.format || '').localeCompare(b.format || '', 'zh-CN')
    if (byFmt !== 0) return byFmt
    return Number(a.rank || 0) - Number(b.rank || 0)
  })
})

const validate = (score) => {
  if (!score.name || !score.name.trim()) return '姓名不能为空'
  if (!score.bow_type) return '请选择弓种'
  if (!score.distance) return '请选择距离'
  if (!score.format) return '请选择赛制'
  if (!Number.isInteger(Number(score.rank)) || Number(score.rank) < 1) return '排名必须是正整数'
  return ''
}

const saveScore = async (score) => {
  const msg = validate(score)
  if (msg) {
    manageMsg.show('error', `成绩 ID ${score.id}：${msg}`)
    return false
  }

  const set = new Set(savingIds.value)
  set.add(score.id)
  savingIds.value = set

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
    const idx = props.scores.findIndex(item => item.id === score.id)
    if (idx >= 0) {
      Object.assign(props.scores[idx], {
        id: updated.id,
        event_id: updated.event_id,
        name: updated.name || '',
        club: updated.club || '',
        bow_type: updated.bow_type || '',
        distance: updated.distance || '',
        format: updated.format || '',
        rank: Number(updated.rank || 0)
      })
    }
    snapshot()
    manageMsg.show('success', `成绩 ID ${score.id} 保存成功`)
    return true
  } catch (error) {
    manageMsg.show('error', error.detail || error.message || '保存失败，请重试')
    return false
  } finally {
    const next = new Set(savingIds.value)
    next.delete(score.id)
    savingIds.value = next
  }
}

const markDelete = (scoreId) => {
  const next = new Set(deletedIds.value)
  next.add(scoreId)
  deletedIds.value = next
}

const confirmDeleteScore = async (scoreId) => {
  const set = new Set(savingIds.value)
  set.add(scoreId)
  savingIds.value = set

  try {
    await scoreAPI.delete(scoreId)
    const idx = props.scores.findIndex(item => item.id === scoreId)
    if (idx >= 0) props.scores.splice(idx, 1)
    const next = new Set(deletedIds.value)
    next.delete(scoreId)
    deletedIds.value = next
    delete originalMap.value[scoreId]
    manageMsg.show('success', `成绩 ID ${scoreId} 已删除`)
  } catch (error) {
    manageMsg.show('error', error.detail || error.message || '删除失败，请重试')
  } finally {
    const next = new Set(savingIds.value)
    next.delete(scoreId)
    savingIds.value = next
  }
}

const saveAllModified = async () => {
  const deleted = currentTabScores.value.filter(item => deletedIds.value.has(item.id))
  const changed = currentTabScores.value.filter(item => !deletedIds.value.has(item.id) && isModified(item))
  if (changed.length === 0 && deleted.length === 0) {
    manageMsg.show('error', '当前弓种没有待保存的修改')
    return
  }

  batchSaving.value = true
  let successCount = 0
  let deleteCount = 0
  const failed = []

  for (const score of deleted) {
    try {
      await scoreAPI.delete(score.id)
      const idx = props.scores.findIndex(item => item.id === score.id)
      if (idx >= 0) props.scores.splice(idx, 1)
      const next = new Set(deletedIds.value)
      next.delete(score.id)
      deletedIds.value = next
      delete originalMap.value[score.id]
      deleteCount += 1
    } catch (error) {
      failed.push(`ID ${score.id}：删除失败`)
    }
  }

  for (const score of changed) {
    const msg = validate(score)
    if (msg) {
      failed.push(`ID ${score.id}：${msg}`)
      continue
    }
    const ok = await saveScore(score)
    if (ok) successCount += 1
    else failed.push(`ID ${score.id}：保存失败`)
  }

  const parts = []
  if (successCount > 0) parts.push(`保存 ${successCount} 条`)
  if (deleteCount > 0) parts.push(`删除 ${deleteCount} 条`)

  if (failed.length > 0) {
    manageMsg.show('error', `批量操作完成：${parts.join('，')}，失败 ${failed.length} 条\n${failed.join('\n')}`)
  } else {
    manageMsg.show('success', `批量操作成功：${parts.join('，')}`)
  }
  batchSaving.value = false
}

const resetScore = (scoreId) => {
  // Restore deletion mark
  if (deletedIds.value.has(scoreId)) {
    const next = new Set(deletedIds.value)
    next.delete(scoreId)
    deletedIds.value = next
  }
  // Restore original field values
  const original = originalMap.value[scoreId]
  if (!original) return
  const idx = props.scores.findIndex(item => item.id === scoreId)
  if (idx >= 0) {
    Object.assign(props.scores[idx], { ...original })
  }
}
</script>

<style scoped lang="scss" src="@/styles/ScoreManagePanel.scss" />
