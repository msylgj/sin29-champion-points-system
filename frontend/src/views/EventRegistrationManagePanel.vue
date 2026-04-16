<template>
  <div class="section">
    <h2 class="section-title">已导入报名</h2>
    <p class="section-help">支持查看和编辑当前赛年赛季已导入的报名数据。</p>

    <div v-if="loading" class="empty-tip">报名加载中...</div>
    <div v-else-if="registrations.length === 0" class="empty-tip">当前赛年赛季暂无报名</div>
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
          <select v-model="selectedDistance" class="manage-filter-select">
            <option value="">全部距离</option>
            <option v-for="item in distances" :key="item.code" :value="item.code">
              {{ item.name }}
            </option>
          </select>
          <select v-model="selectedGenderGroup" class="manage-filter-select">
            <option value="">全部分组</option>
            <option v-for="item in competitionGenderGroups" :key="item.code" :value="item.code">
              {{ item.name }}
            </option>
          </select>
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
              <th>距离</th>
              <th>比赛弓种</th>
              <th>积分弓种</th>
              <th>分组</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="registration in filteredRegistrations"
              :key="registration.id"
              :class="{ 'row-modified': isRowChanged(registration), 'row-deleted': deletedIds.has(registration.id) }"
            >
              <td>{{ registration.id }}</td>
              <td>
                <input v-model="registration.name" class="cell-input" type="text" :disabled="deletedIds.has(registration.id)" />
              </td>
              <td>
                <input v-model="registration.club" class="cell-input" type="text" :disabled="deletedIds.has(registration.id)" />
              </td>
              <td>
                <select v-model="registration.distance" class="cell-input" :disabled="deletedIds.has(registration.id)">
                  <option v-for="item in distances" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td>
                <select
                  v-model="registration.competition_bow_type"
                  class="cell-input"
                  :disabled="deletedIds.has(registration.id)"
                  @change="handleCompetitionBowTypeChange(registration)"
                >
                  <option v-for="item in bowTypes" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td>
                <select
                  v-model="registration.points_bow_type"
                  class="cell-input"
                  :disabled="deletedIds.has(registration.id) || !isSightlessBow(registration.competition_bow_type)"
                >
                  <option
                    v-for="item in getPointsBowTypeOptions(registration)"
                    :key="item.code"
                    :value="item.code"
                  >
                    {{ item.name }}
                  </option>
                </select>
              </td>
              <td>
                <select v-model="registration.competition_gender_group" class="cell-input" :disabled="deletedIds.has(registration.id)">
                  <option v-for="item in competitionGenderGroups" :key="item.code" :value="item.code">{{ item.name }}</option>
                </select>
              </td>
              <td class="action-cell">
                <template v-if="deletedIds.has(registration.id)">
                  <button
                    type="button"
                    class="btn-row-delete-confirm"
                    :disabled="savingIds.has(registration.id)"
                    @click="confirmDeleteRegistration(registration.id)"
                  >
                    {{ savingIds.has(registration.id) ? '删除中...' : '确认删除' }}
                  </button>
                  <button
                    type="button"
                    class="btn-row-reset"
                    :disabled="savingIds.has(registration.id)"
                    @click="resetRegistration(registration.id)"
                  >
                    撤销
                  </button>
                </template>
                <template v-else>
                  <button
                    type="button"
                    class="btn-row-save"
                    :disabled="savingIds.has(registration.id)"
                    @click="saveRegistration(registration)"
                  >
                    {{ savingIds.has(registration.id) ? '保存中...' : '保存' }}
                  </button>
                  <button
                    type="button"
                    class="btn-row-reset"
                    :disabled="savingIds.has(registration.id)"
                    @click="resetRegistration(registration.id)"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    class="btn-row-delete"
                    :disabled="savingIds.has(registration.id)"
                    @click="markDelete(registration.id)"
                  >
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
import { computed, ref, watch } from 'vue'

import { eventRegistrationAPI } from '@/api'
import { useMessage } from '@/composables/useMessage'

const emit = defineEmits(['changed'])

const props = defineProps({
  registrations: { type: Array, required: true },
  loading: { type: Boolean, default: false },
  bowTypes: { type: Array, required: true },
  distances: { type: Array, required: true },
  competitionGenderGroups: { type: Array, required: true },
})

const manageMsg = useMessage(5000)

const activeBowType = ref('')
const originalMap = ref({})
const savingIds = ref(new Set())
const deletedIds = ref(new Set())
const showModifiedOnly = ref(false)
const batchSaving = ref(false)
const nameKeyword = ref('')
const selectedDistance = ref('')
const selectedGenderGroup = ref('')

const snapshot = () => {
  const map = {}
  props.registrations.forEach(item => {
    map[item.id] = { ...item }
  })
  originalMap.value = map
}

const sightlessPointBowTypeOptions = computed(() => {
  return props.bowTypes.filter(item => ['barebow', 'longbow', 'traditional'].includes(item.code))
})

const bowTabs = computed(() => {
  const bowSet = new Set((props.registrations || []).map(item => item.competition_bow_type))
  return props.bowTypes.filter(item => bowSet.has(item.code))
})

watch(() => props.registrations, () => {
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

const normalize = (registration = {}) => ({
  name: (registration.name || '').trim(),
  club: (registration.club || '').trim(),
  distance: registration.distance || '',
  competition_bow_type: registration.competition_bow_type || '',
  points_bow_type: registration.points_bow_type || '',
  competition_gender_group: registration.competition_gender_group || '',
})

const isModified = (registration) => {
  const original = originalMap.value[registration.id]
  if (!original) return false
  const a = normalize(registration)
  const b = normalize(original)
  return ['name', 'club', 'distance', 'competition_bow_type', 'points_bow_type', 'competition_gender_group'].some(key => a[key] !== b[key])
}

const isRowChanged = (registration) => {
  return deletedIds.value.has(registration.id) || isModified(registration)
}

const currentTabRegistrations = computed(() => {
  if (!activeBowType.value) return []
  return props.registrations.filter(item => item.competition_bow_type === activeBowType.value)
})

const modifiedCount = computed(() => {
  return currentTabRegistrations.value.filter(item => isRowChanged(item)).length
})

const filteredRegistrations = computed(() => {
  if (!activeBowType.value) return []
  const keyword = (nameKeyword.value || '').trim().toLowerCase()

  const list = props.registrations.filter(item => {
    if (item.competition_bow_type !== activeBowType.value) return false
    if (showModifiedOnly.value && !isRowChanged(item)) return false
    if (keyword && !(item.name || '').toLowerCase().includes(keyword)) return false
    if (selectedDistance.value && item.distance !== selectedDistance.value) return false
    if (selectedGenderGroup.value && item.competition_gender_group !== selectedGenderGroup.value) return false
    return true
  })

  return [...list].sort((a, b) => {
    const parseDistance = (value) => {
      const match = String(value || '').match(/\d+/)
      return match ? Number(match[0]) : 0
    }

    const byDistance = parseDistance(b.distance) - parseDistance(a.distance)
    if (byDistance !== 0) return byDistance

    const byGender = (a.competition_gender_group || '').localeCompare(b.competition_gender_group || '', 'zh-CN')
    if (byGender !== 0) return byGender

    return (a.name || '').localeCompare(b.name || '', 'zh-CN')
  })
})

const isSightlessBow = (competitionBowType) => competitionBowType === 'sightless'

const getPointsBowTypeOptions = (registration) => {
  if (isSightlessBow(registration.competition_bow_type)) {
    return sightlessPointBowTypeOptions.value
  }

  const matched = props.bowTypes.find(item => item.code === registration.competition_bow_type)
  return matched ? [matched] : []
}

const handleCompetitionBowTypeChange = (registration) => {
  if (isSightlessBow(registration.competition_bow_type)) {
    if (!['barebow', 'longbow', 'traditional'].includes(registration.points_bow_type)) {
      registration.points_bow_type = sightlessPointBowTypeOptions.value[0]?.code || 'barebow'
    }
    return
  }

  registration.points_bow_type = registration.competition_bow_type || ''
}

const validate = (registration) => {
  if (!registration.name || !registration.name.trim()) return '姓名不能为空'
  if (!registration.club || !registration.club.trim()) return '俱乐部不能为空'
  if (!registration.distance) return '请选择距离'
  if (!registration.competition_bow_type) return '请选择比赛弓种'
  if (!registration.competition_gender_group) return '请选择分组'

  if (isSightlessBow(registration.competition_bow_type)) {
    if (!['barebow', 'longbow', 'traditional'].includes(registration.points_bow_type)) {
      return '无瞄弓的积分弓种仅支持：光弓、美猎弓、传统弓'
    }
  } else if (registration.points_bow_type !== registration.competition_bow_type) {
    return '非无瞄弓项目的积分弓种必须与比赛弓种一致'
  }

  return ''
}

const saveRegistration = async (registration, emitChange = true) => {
  manageMsg.clear()
  handleCompetitionBowTypeChange(registration)
  const msg = validate(registration)
  if (msg) {
    manageMsg.show('error', `报名 ID ${registration.id}：${msg}`)
    return false
  }

  const next = new Set(savingIds.value)
  next.add(registration.id)
  savingIds.value = next

  try {
    const payload = {
      name: registration.name.trim(),
      club: registration.club.trim(),
      distance: registration.distance,
      competition_bow_type: registration.competition_bow_type,
      points_bow_type: registration.points_bow_type,
      competition_gender_group: registration.competition_gender_group,
    }
    const updated = await eventRegistrationAPI.update(registration.id, payload)
    const idx = props.registrations.findIndex(item => item.id === registration.id)
    if (idx >= 0) {
      Object.assign(props.registrations[idx], {
        ...updated,
      })
    }
    snapshot()
    manageMsg.show('success', `报名 ID ${registration.id} 保存成功`)
    if (emitChange) {
      emit('changed')
    }
    return true
  } catch (error) {
    manageMsg.show('error', error.detail || error.message || '保存失败，请重试')
    return false
  } finally {
    const after = new Set(savingIds.value)
    after.delete(registration.id)
    savingIds.value = after
  }
}

const markDelete = (registrationId) => {
  const next = new Set(deletedIds.value)
  next.add(registrationId)
  deletedIds.value = next
}

const confirmDeleteRegistration = async (registrationId) => {
  manageMsg.clear()
  const next = new Set(savingIds.value)
  next.add(registrationId)
  savingIds.value = next

  try {
    await eventRegistrationAPI.delete(registrationId)
    const idx = props.registrations.findIndex(item => item.id === registrationId)
    if (idx >= 0) props.registrations.splice(idx, 1)
    const deleted = new Set(deletedIds.value)
    deleted.delete(registrationId)
    deletedIds.value = deleted
    delete originalMap.value[registrationId]
    manageMsg.show('success', `报名 ID ${registrationId} 已删除`)
    emit('changed')
  } catch (error) {
    manageMsg.show('error', error.detail || error.message || '删除失败，请重试')
  } finally {
    const after = new Set(savingIds.value)
    after.delete(registrationId)
    savingIds.value = after
  }
}

const saveAllModified = async () => {
  manageMsg.clear()
  const deleted = currentTabRegistrations.value.filter(item => deletedIds.value.has(item.id))
  const changed = currentTabRegistrations.value.filter(item => !deletedIds.value.has(item.id) && isModified(item))
  if (changed.length === 0 && deleted.length === 0) {
    manageMsg.show('error', '当前弓种没有待保存的修改')
    return
  }

  batchSaving.value = true
  let successCount = 0
  let deleteCount = 0
  const failed = []

  for (const registration of deleted) {
    try {
      await eventRegistrationAPI.delete(registration.id)
      const idx = props.registrations.findIndex(item => item.id === registration.id)
      if (idx >= 0) props.registrations.splice(idx, 1)
      const deletedSet = new Set(deletedIds.value)
      deletedSet.delete(registration.id)
      deletedIds.value = deletedSet
      delete originalMap.value[registration.id]
      deleteCount += 1
    } catch {
      failed.push(`ID ${registration.id}：删除失败`)
    }
  }

  for (const registration of changed) {
    handleCompetitionBowTypeChange(registration)
    const msg = validate(registration)
    if (msg) {
      failed.push(`ID ${registration.id}：${msg}`)
      continue
    }
    const ok = await saveRegistration(registration, false)
    if (ok) successCount += 1
    else failed.push(`ID ${registration.id}：保存失败`)
  }

  const parts = []
  if (successCount > 0) parts.push(`保存 ${successCount} 条`)
  if (deleteCount > 0) parts.push(`删除 ${deleteCount} 条`)

  if (successCount > 0 || deleteCount > 0) {
    emit('changed')
  }

  if (failed.length > 0) {
    manageMsg.show('error', `批量操作完成：${parts.join('，')}，失败 ${failed.length} 条\n${failed.join('\n')}`)
  } else {
    manageMsg.show('success', `批量操作成功：${parts.join('，')}`)
  }
  batchSaving.value = false
}

const resetRegistration = (registrationId) => {
  if (deletedIds.value.has(registrationId)) {
    const next = new Set(deletedIds.value)
    next.delete(registrationId)
    deletedIds.value = next
  }

  const original = originalMap.value[registrationId]
  if (!original) return
  const idx = props.registrations.findIndex(item => item.id === registrationId)
  if (idx >= 0) {
    Object.assign(props.registrations[idx], { ...original })
  }
}
</script>

<style scoped lang="scss" src="@/styles/EventRegistrationManagePanel.scss" />
