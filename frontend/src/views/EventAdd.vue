<template>
  <div class="event-add-page safe-area" :class="{ 'wizard-mode': isWizard }">
    <div v-if="!isWizard" class="page-header">
      <div class="header-top">
        <button class="btn-back" @click="returnToEventList" :disabled="loading || returning" title="返回赛事清单">
          ← 返回
        </button>
        <div class="header-title-wrap">
          <h1>赛事配置</h1>
          <p class="subtitle">按年度和赛季配置参赛信息</p>
        </div>
        <span class="header-spacer" aria-hidden="true"></span>
      </div>
    </div>

    <form @submit.prevent="submitForm" class="form-container">
      <div v-if="isManaged && managedError" class="failure-notice" role="alert" data-test="managed-event-error">
        <div><strong>指定赛事加载失败</strong><p>{{ managedError }}。不会切换到其他赛事或创建新赛事，请重试或返回赛事清单。</p></div>
        <button type="button" class="btn-retry-inline" data-test="retry-managed-event" :disabled="wizardBusy" @click="loadManagedEvent">重试加载指定赛事</button>
      </div>
      <p v-if="isManaged && existingConfigLoading" role="status">正在加载指定赛事，请稍候…</p>

      <div v-if="dictionaryLoadFailed || existingConfigLoadFailed || existingRegistrationLoadFailed" class="page-feedback-list">
        <div v-if="dictionaryLoadFailed" class="failure-notice">
          <div>
            <strong>表单字典加载失败</strong>
            <p>赛事配置依赖弓种、距离和组别字典，请重试加载表单数据。</p>
          </div>
          <button type="button" :disabled="(isWizard || isManaged) && wizardBusy" class="btn-retry-inline" @click="loadDictionaries">重试加载</button>
        </div>
        <div v-if="existingConfigLoadFailed" class="failure-notice">
          <div>
            <strong>历史配置加载失败</strong>
            <p>当前未能获取同年度同赛季的已有配置，你可以重新尝试加载。</p>
          </div>
          <button type="button" :disabled="(isWizard || isManaged) && wizardBusy" class="btn-retry-inline" @click="loadExistingEventConfigurations">重试加载历史配置</button>
        </div>
        <div v-if="existingRegistrationLoadFailed" class="failure-notice">
          <div>
            <strong>历史报名加载失败</strong>
            <p>当前未能获取同年度同赛季的已有报名，可重新尝试加载。</p>
          </div>
          <button type="button" :disabled="(isWizard || isManaged) && wizardBusy" class="btn-retry-inline" @click="isManaged ? loadManagedEvent() : loadExistingRegistrations()">重试加载报名</button>
        </div>
      </div>

      <div v-if="isWizardLocked && !wizardEventValid" class="failure-notice" role="alert">向导赛事信息无效，请返回上一步重新选择。</div>
      <p v-if="isWizard && wizardBusy" class="wizard-loading" role="status">正在处理赛事数据，请稍候…</p>

      <!-- 基本信息 -->
      <div class="section">
        <h2 class="section-title">基本信息</h2>
        
        <div class="form-group">
          <label for="year">年度 *</label>
          <input 
            id="year"
            v-model.number="formData.year"
            :disabled="isManaged || isWizardLocked || (isWizard && wizardBusy) || loading || savedPage"
            type="number" 
            :min="isManaged ? undefined : currentYear - 10"
            :max="isManaged ? undefined : currentYear + 10"
            required
            class="form-input"
            placeholder="如：2024"
          />
          <small class="help-text">请选择赛事举办年度</small>
        </div>

        <div class="form-group">
          <label for="season">赛季 *</label>
          <select v-model="formData.season" id="season" required class="form-input" :disabled="isManaged || isWizardLocked || (isWizard && wizardBusy) || loading || savedPage">
            <option value="">请选择赛季</option>
            <option value="春季赛">春季赛（1-3月）</option>
            <option value="夏季赛">夏季赛（4-6月）</option>
            <option value="秋季赛">秋季赛（7-9月）</option>
            <option value="冬季赛">冬季赛（10-12月）</option>
          </select>
          <small class="help-text">选择赛事所属的季度</small>
        </div>

        <div v-if="existingEventId" class="event-exist-feedback">
          <div class="import-message import-message-success">
            {{ isCreateWizard ? '检测到该赛事已存在，确认后使用已有赛事继续，不修改已有数据。' : isWizardLocked ? '当前向导赛事已锁定，不会切换到其他赛事。' : '检测到该赛事已存在，已自动带入历史配置，保存后将更新该赛事配置' }}
          </div>
        </div>
      </div>

      <div v-if="!isWizard || isRegistrationsWizard" class="section" data-test="registration-section">
        <h2 class="section-title">导入报名表</h2>
        <p class="section-help">支持 Excel 导入报名数据，字段包括姓名、俱乐部、距离、比赛弓种、积分弓种、分组。</p>

        <div class="upload-area">
          <input
            type="file"
            ref="registrationFileInput"
            @change="onRegistrationFileSelected"
            accept=".xlsx,.xls"
            hidden
          />
          <button type="button" @click="registrationFileInput?.click()" class="btn-upload" :disabled="isWizard ? !wizardReady : !pageReady">
            选择 Excel 文件
          </button>
          <p class="upload-help">
              支持格式：Excel (.xlsx, .xls)<br/>
              <strong>列标题需包括：</strong><br/>
              <span style="color: #667eea;">姓名</span>、<span style="color: #667eea;">俱乐部</span>、<span style="color: #667eea;">距离</span>、<span style="color: #667eea;">比赛弓种</span>、<span style="color: #667eea;">积分弓种</span>、<span style="color: #667eea;">分组</span><br/>
              <em style="font-size: 12px; color: #999;">弓种、距离、分组的值支持使用字典名称；导入时会按字典名称做模糊匹配，例如"传统"匹配"传统弓"、"男子"匹配"男子组"，距离支持"10"、"10m"、"18"、"18m"等写法</em><br/>
              <em>当比赛弓种为“无瞄弓”时，积分弓种仅支持：光弓、美猎弓、传统弓，否则与比赛弓种相同。</em><br/>
              <strong>弓种枚举：</strong>{{ bowTypeEnumText }}<br/>
              <strong>距离枚举：</strong>{{ distanceEnumText }}<br/>
              <strong>分组枚举：</strong>{{ genderGroupEnumText }}<br/>
              系统会自动识别列标题并匹配字段
          </p>
          
        </div>

        <div v-if="registrationUploadedFileName" class="file-info">
          已选择：{{ registrationUploadedFileName }}
        </div>

        <div v-if="registrationBatch.length > 0" class="scores-preview">
          <h3>待导入报名 ({{ registrationBatch.length }}条，合法 {{ validRegistrationCount }} / 异常 {{ invalidRegistrationCount }})</h3>
          <div
            v-for="section in registrationPreviewSections"
            :key="section.key"
            class="preview-section"
          >
            <div class="preview-section-header" :class="`preview-section-${section.key}`">
              <span>{{ section.title }}</span>
              <strong>{{ section.items.length }}</strong>
            </div>
            <div v-if="section.items.length === 0" class="preview-empty">
              {{ section.emptyText }}
            </div>
            <table v-else class="preview-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>俱乐部</th>
                  <th>距离</th>
                  <th>比赛弓种</th>
                  <th>积分弓种</th>
                  <th>分组</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="{ item: registration, index } in section.items"
                  :key="`${section.key}-${index}`"
                  :class="{ 'row-error': !registration.__valid, 'row-duplicate': isRegistrationPreviewDuplicate(registration) }"
                >
                  <td>{{ registration.name }}</td>
                  <td>{{ registration.club || '-' }}</td>
                  <td>{{ getDistanceLabel(registration.distance) }}</td>
                  <td>{{ getBowTypeLabel(registration.competition_bow_type) }}</td>
                  <td>{{ getBowTypeLabel(registration.points_bow_type) }}</td>
                  <td>{{ getGenderGroupLabel(registration.competition_gender_group) }}</td>
                  <td>
                    <span v-if="registration.__valid && registration.__duplicate_in_file_to_remove" class="status-tag status-duplicate" title="Excel 中存在重复行，导入时该行将被移除">重复（将移除）</span>
                    <span v-else-if="registration.__valid && registration.__duplicate_with_existing" class="status-tag status-duplicate" title="与已有报名重复，导入时将覆盖原记录">重复（将覆盖）</span>
                    <span v-else-if="registration.__valid && registration.__duplicate_in_file" class="status-tag status-duplicate" title="Excel 中存在重复行，导入时保留第一条">重复（保留）</span>
                    <span v-else-if="registration.__valid" class="status-tag status-ok">通过</span>
                    <span v-else class="status-tag status-error" :title="registration.__errors.join('；')">异常</span>
                  </td>
                  <td>
                    <button type="button" @click="removeRegistrationBatchItem(index)" class="btn-remove-small" :disabled="(isWizard || isManaged) && wizardBusy">
                      删除
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="registrationParseMsg.successMsg.value || registrationParseMsg.errorMsg.value" class="import-feedback">
          <div v-if="registrationParseMsg.successMsg.value" class="import-message import-message-success">
            {{ registrationParseMsg.successMsg.value }}
          </div>
          <div v-if="registrationParseMsg.errorMsg.value" class="import-message import-message-error">
            {{ registrationParseMsg.errorMsg.value }}
          </div>
        </div>

        <div class="import-actions" v-if="registrationBatch.length > 0">
          <button
            type="button"
            @click="submitRegistrationImport"
            class="btn-submit"
            :disabled="registrationImportLoading || invalidRegistrationCount > 0 || (isWizard ? !wizardReady : !pageReady)"
          >
            {{ registrationImportLoading ? '导入中...' : `确认导入报名 (${validRegistrationCount}条)` }}
          </button>
        </div>
        <div v-if="isRegistrationsWizard" class="import-actions wizard-registration-actions">
          <button v-if="registrationUploadedFileName || registrationBatch.length || registrationParseMsg.errorMsg.value" type="button" class="btn-cancel" data-test="clear-registration-draft" :disabled="wizardBusy" @click="clearRegistrationDraft">清除待导入文件</button>
          <button type="button" class="btn-submit" data-test="use-existing-registrations" :disabled="!wizardReady || existingRegistrations.length === 0 || registrationBatch.length > 0 || Boolean(registrationUploadedFileName) || Boolean(registrationParseMsg.errorMsg.value)" @click="useExistingRegistrations">使用已有报名并继续（{{ existingRegistrations.length }}条）</button>
        </div>
      </div>

      <!-- 赛事配置 -->
      <div v-if="!isWizard || isTeamsWizard" class="section" data-test="configuration-section">
        <h2 class="section-title">赛事配置</h2>
        <p class="section-help">{{ isTeamsWizard ? '仅填写团体和混双队伍数；个人赛人数和未显示的历史配置保持不变。没有团队项目也可保存并继续。' : '每个弓种一张表。个人赛按距离和性别分组填写；混双、团体按距离填写。' }}</p>

        <div v-if="dictionaryReady && isTeamsWizard" class="team-config-list" data-test="team-config-editor">
          <template v-for="bowType in bowTypes" :key="bowType.code">
            <div v-if="hasBowTypeDistances(bowType.code)" class="bow-config-group">
              <h3 class="bow-type-title">{{ bowType.name }}</h3>
              <div class="team-distance-grid">
                <fieldset v-for="distance in getBowTypeDistances(bowType.code)" :key="distance.code"
                  class="team-distance-card" :disabled="!wizardReady">
                  <legend>{{ distance.name }} <span class="team-distance-group">{{ getGroupCode(bowType.code, distance.code) }}</span></legend>
                  <div class="team-count-fields">
                    <label v-for="genderGroup in competitionGenderGroups" :key="genderGroup.code" class="team-count-field">
                      <span>团体 · {{ genderGroup.name }}</span>
                      <input v-model.number="configTable[genderGroup.code][bowType.code][distance.code].team_count"
                        type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0"
                        class="team-count-input" data-team-field="team_count"
                        :aria-label="bowType.name + ' ' + distance.name + ' 团体 · ' + genderGroup.name" />
                    </label>
                    <label v-if="configTable[sharedGenderGroupCode]?.[bowType.code]?.[distance.code]" class="team-count-field">
                      <span>混双 · 混合组</span>
                      <input v-model.number="configTable[sharedGenderGroupCode][bowType.code][distance.code].mixed_doubles_team_count"
                        type="text" inputmode="numeric" pattern="[0-9]*" autocomplete="off" placeholder="0"
                        class="team-count-input" data-team-field="mixed_doubles_team_count"
                        :aria-label="bowType.name + ' ' + distance.name + ' 混双 · 混合组'" />
                    </label>
                  </div>
                </fieldset>
              </div>
            </div>
          </template>
        </div>

        <div v-else-if="dictionaryReady" class="bow-config-grid">
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
                          class="readonly-cell"
                        >
                          {{ getIndividualCount(genderGroup.code, bowType.code, distance.code) }}
                        </td>
                      </template>
                    </tr>
                    <tr>
                      <td class="format-label">{{ countRows[1].label }}</td>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-team-row`">
                        <td
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}-team`"
                          class="input-cell shared-cell"
                        >
                          <input
                            v-model.number="configTable[genderGroup.code][bowType.code][distance.code].team_count"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="off"
                            class="table-input"
                            :disabled="!isWizard && !pageReady"
                            placeholder="0"
                          />
                        </td>
                      </template>
                    </tr>
                    <tr>
                      <td class="format-label">{{ countRows[2].label }}</td>
                      <template v-for="distance in getBowTypeDistances(bowType.code)" :key="`${distance.code}-mixed-row`">
                        <td
                          v-for="genderGroup in competitionGenderGroups"
                          :key="`${distance.code}-${genderGroup.code}-mixed`"
                          :class="genderGroup.code === sharedGenderGroupCode ? 'input-cell shared-cell' : 'unavailable-cell'"
                        >
                          <input
                            v-if="genderGroup.code === sharedGenderGroupCode"
                            v-model.number="configTable[sharedGenderGroupCode][bowType.code][distance.code].mixed_doubles_team_count"
                            type="text"
                            inputmode="numeric"
                            pattern="[0-9]*"
                            autocomplete="off"
                            class="table-input"
                            :disabled="!isWizard && !pageReady"
                            placeholder="0"
                          />
                          <template v-else>-</template>
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

      <EventRegistrationManagePanel
        v-if="!isWizard && (!isManaged || pageReady)"
        :registrations="existingRegistrations"
        :loading="existingRegistrationsLoading"
        :bow-types="bowTypes"
        :distances="distances"
        :competition-gender-groups="competitionGenderGroups"
        @changed="handleRegistrationsChanged"
      />

      <p v-if="!isWizard && savedPage" role="status" data-test="saved-event-status">赛事配置已保存。请点击完成返回赛事清单，无需重复保存。</p>
      <!-- 提交按钮 -->
      <div v-if="!isRegistrationsWizard" class="form-actions">
        <button v-if="!isWizard" type="button" @click="returnToEventList" :disabled="loading || returning" class="btn-cancel">
          取消
        </button>
        <button type="submit" class="btn-submit" data-test="event-submit" :disabled="loading || returning || (isWizard ? !wizardReady : (!pageReady && !savedPage))">
          {{ isWizard ? (loading ? '保存中...' : isCreateWizard ? (existingEventId ? '使用已有赛事并继续' : '创建赛事并继续') : '保存团队配置并继续') : savedPage ? '完成' : loading ? (existingEventId ? '更新中...' : '保存中...') : (existingEventId ? '更新配置' : '保存赛事') }}
        </button>
      </div>
    </form>

    <!-- 成功提示 -->
    <div v-if="formMsg.successMsg.value" class="submit-floating-message submit-floating-success">
      {{ formMsg.successMsg.value }}
    </div>

    <!-- 错误提示 -->
    <div v-if="formMsg.errorMsg.value" class="error-message">
      {{ formMsg.errorMsg.value }}
    </div>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { eventAPI, eventConfigAPI, eventRegistrationAPI } from '@/api'
import { useDictionaries } from '@/composables/useDictionaries'
import { useEventConfigGrid } from '@/composables/useEventConfigGrid'
import { useMessage } from '@/composables/useMessage'
import {
  buildRegistrationUniqueKey,
  parseRegistrationImportData,
  recalculateRegistrationDuplicateFlags,
} from '@/utils/registrationImportParsing'
import EventRegistrationManagePanel from './EventRegistrationManagePanel.vue'
import { getAllPages } from '@/utils/pagination'

const props = defineProps({
  wizardMode: { type: String, default: '', validator: value => ['', 'create', 'registrations', 'teams'].includes(value) },
  wizardEvent: { type: Object, default: null },
  managedEventId: { type: [String, Number, Array], default: undefined },
})
const emit = defineEmits(['complete', 'busy-change'])
const isCreateWizard = computed(() => props.wizardMode === 'create')
const isRegistrationsWizard = computed(() => props.wizardMode === 'registrations')
const isTeamsWizard = computed(() => props.wizardMode === 'teams')
const isWizard = computed(() => isCreateWizard.value || isRegistrationsWizard.value || isTeamsWizard.value)
const isWizardLocked = computed(() => isRegistrationsWizard.value || isTeamsWizard.value)
const isManaged = computed(() => !isWizard.value && props.managedEventId !== undefined)
const managedId = computed(() => {
  const value = props.managedEventId
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
})
const managedEvent = ref(null)
const managedError = ref('')
const loadedConfigurations = ref([])
const wizardEventValid = computed(() => Number.isSafeInteger(props.wizardEvent?.id) && props.wizardEvent.id > 0 &&
  Number.isInteger(props.wizardEvent?.year) && props.wizardEvent.year >= 2000 && props.wizardEvent.year <= 2100 &&
  ['春季赛', '夏季赛', '秋季赛', '冬季赛'].includes(props.wizardEvent?.season))
let disposed = false
let registrationLoadVersion = 0
let configurationLoadVersion = 0
let fileReadVersion = 0
const router = useRouter()
const currentYear = new Date().getFullYear()
const loading = ref(false)
const existingEventId = ref(null)
const formMsg = useMessage(5000)
const savedPage = ref(false)
const returning = ref(false)
const returnToEventList = async () => {
  if (returning.value || disposed) return
  returning.value = true
  try {
    const failure = await router.push('/event-list')
    if (failure) throw new Error('导航未完成')
  } catch {
    if (!disposed) formMsg.show('error', savedPage.value ? '赛事配置已保存，但返回赛事清单失败，请点击完成重试' : '返回赛事清单失败，请重试')
  } finally { returning.value = false }
}
const dictionaryLoadFailed = ref(false)
const existingConfigLoadFailed = ref(false)
const existingRegistrationLoadFailed = ref(false)
const sharedGenderGroupCode = 'mixed'
const registrationParseMsg = useMessage()
const registrationImportLoading = ref(false)
const registrationBatch = ref([])
const existingRegistrations = ref([])
const existingRegistrationsLoading = ref(false)
const registrationUploadedFileName = ref('')
const registrationFileInput = ref(null)
const registrationParsing = ref(false)
const dictionaryLoading = ref(false)
const dictionaryReady = ref(false)
const existingConfigLoading = ref(false)
const eventLookupComplete = ref(false)
const registrationsLoaded = ref(false)
const wizardBusy = computed(() => loading.value || registrationImportLoading.value || registrationParsing.value ||
  dictionaryLoading.value || existingConfigLoading.value || existingRegistrationsLoading.value)
const wizardReady = computed(() => !wizardBusy.value && eventLookupComplete.value && !existingConfigLoadFailed.value &&
  (!isWizardLocked.value || wizardEventValid.value) &&
  (isCreateWizard.value || (dictionaryReady.value && !dictionaryLoadFailed.value)) &&
  (!isRegistrationsWizard.value || (registrationsLoaded.value && !existingRegistrationLoadFailed.value)))
const pageReady = computed(() => !isWizard.value && !savedPage.value && !wizardBusy.value && dictionaryReady.value && !dictionaryLoadFailed.value && eventLookupComplete.value && !existingConfigLoadFailed.value && registrationsLoaded.value && !existingRegistrationLoadFailed.value && (!isManaged.value || (!!managedEvent.value && managedEvent.value.id === managedId.value)))
watch(wizardBusy, busy => { if (isWizard.value && !disposed) emit('busy-change', busy) }, { immediate: true, flush: 'sync' })
onUnmounted(() => {
  disposed = true
  registrationLoadVersion += 1
  configurationLoadVersion += 1
  fileReadVersion += 1
  if (isWizard.value) emit('busy-change', false)
})

// 字典数据
const {
  bowTypes,
  distances,
  competitionGenderGroups,
  competitionGroups,
  loadDictionaries: fetchDictionaries
} = useDictionaries()

const formData = ref({
  year: (isWizard.value && props.wizardEvent?.year) || currentYear,
  season: isWizard.value ? props.wizardEvent?.season || '' : ''
})
const bowTypeEnumText = computed(() => bowTypes.value.map(item => `${item.name}`).join('、'))
const distanceEnumText = computed(() => distances.value.map(item => `${item.name}`).join('、'))
const genderGroupEnumText = computed(() => competitionGenderGroups.value.map(item => `${item.name}`).join('、'))

// 配置表数据结构：gender_group => bow_type => distance => count
const configTable = ref({})
const {
  countRows,
  getBowTypeDistances,
  hasBowTypeDistances,
  getGroupCode,
} = useEventConfigGrid(distances, competitionGroups)

// 初始化配置表
const initConfigTable = () => {
  configTable.value = {}
  if (competitionGenderGroups.value.length && bowTypes.value.length && distances.value.length) {
    competitionGenderGroups.value.forEach(genderGroup => {
      configTable.value[genderGroup.code] = {}
      bowTypes.value.forEach(bow => {
        configTable.value[genderGroup.code][bow.code] = {}
        distances.value.forEach(distance => {
          configTable.value[genderGroup.code][bow.code][distance.code] = {
            individual_participant_count: 0,
            mixed_doubles_team_count: 0,
            team_count: 0
          }
        })
      })
    })
  }
}

const applyConfigurationsToTable = (configurations = []) => {
  initConfigTable()
  configurations.forEach(config => {
    const genderGroup = config.gender_group || sharedGenderGroupCode
    const genderGroupMap = configTable.value[genderGroup]
    const bowTypeMap = genderGroupMap?.[config.bow_type]
    const distanceMap = bowTypeMap?.[config.distance]
    if (!distanceMap) return

    distanceMap.individual_participant_count = Number(config.individual_participant_count || 0)
    distanceMap.team_count = Number(config.team_count || 0)

    const sharedDistanceMap = configTable.value[sharedGenderGroupCode]?.[config.bow_type]?.[config.distance]
    if (sharedDistanceMap) {
      sharedDistanceMap.mixed_doubles_team_count += Number(config.mixed_doubles_team_count || 0)
    }
  })

  if (!isTeamsWizard.value) applyRegistrationCountsToTable(existingRegistrations.value)
}

const applyRegistrationCountsToTable = (registrations = []) => {
  if (!competitionGenderGroups.value.length || !bowTypes.value.length || !distances.value.length) {
    return
  }

  if (Object.keys(configTable.value).length === 0) {
    initConfigTable()
  }

  competitionGenderGroups.value.forEach(genderGroup => {
    bowTypes.value.forEach(bow => {
      distances.value.forEach(distance => {
        const counts = configTable.value[genderGroup.code]?.[bow.code]?.[distance.code]
        if (counts) {
          counts.individual_participant_count = 0
        }
      })
    })
  })

  ;(registrations || []).forEach(item => {
    const genderGroup = item.competition_gender_group || sharedGenderGroupCode
    const counts = configTable.value[genderGroup]?.[item.competition_bow_type]?.[item.distance]
    if (!counts) return
    counts.individual_participant_count += 1
  })
}

const getIndividualCount = (genderGroupCode, bowTypeCode, distanceCode) => {
  return Number(
    configTable.value[genderGroupCode]?.[bowTypeCode]?.[distanceCode]?.individual_participant_count || 0
  )
}

const assertLockedEvent = detail => {
  const expected = props.wizardEvent
  if (!wizardEventValid.value || detail?.id !== expected.id || detail?.year !== expected.year || detail?.season !== expected.season) {
    throw new Error('向导赛事信息已变化，请返回上一步重新选择')
  }
}

const loadExistingRegistrations = async () => {
  const version = ++registrationLoadVersion
  registrationsLoaded.value = false
  if (!formData.value.season || (isManaged.value && !managedEvent.value) || (isWizardLocked.value && !wizardEventValid.value)) {
    existingRegistrations.value = []
    existingRegistrationLoadFailed.value = isWizardLocked.value
    existingRegistrationsLoading.value = false
    applyRegistrationCountsToTable([])
    return false
  }
  const year = isManaged.value ? managedEvent.value.year : isWizardLocked.value ? props.wizardEvent.year : formData.value.year
  const season = isManaged.value ? managedEvent.value.season : isWizardLocked.value ? props.wizardEvent.season : formData.value.season
  existingRegistrationsLoading.value = true
  try {
    let records
    if (isWizard.value || isManaged.value) {
      records = await getAllPages(eventRegistrationAPI.getList, { year, season }, 1000)
      if (records.some(item => item.year !== year || item.season !== season)) throw new Error('报名赛事信息不一致，请重试')
    } else {
      const response = await eventRegistrationAPI.getList({ page: 1, page_size: 1000, year, season })
      records = response.items || []
    }
    if (disposed || version !== registrationLoadVersion) return false
    existingRegistrations.value = records
    existingRegistrationLoadFailed.value = false
    registrationsLoaded.value = true
    applyRegistrationCountsToTable(records)
    return true
  } catch (error) {
    if (disposed || version !== registrationLoadVersion) return false
    console.error('加载已存在报名失败:', error)
    existingRegistrationLoadFailed.value = true
    existingRegistrations.value = []
    applyRegistrationCountsToTable([])
    return false
  } finally {
    if (!disposed && version === registrationLoadVersion) existingRegistrationsLoading.value = false
  }
}

const loadExistingEventConfigurations = async () => {
  if (isManaged.value) return loadManagedEvent()
  const version = ++configurationLoadVersion
  eventLookupComplete.value = false
  if (!formData.value.season || (isWizardLocked.value && !wizardEventValid.value) ||
      (!isCreateWizard.value && (!competitionGenderGroups.value.length || !bowTypes.value.length || !distances.value.length))) {
    existingEventId.value = null
    existingConfigLoading.value = false
    existingConfigLoadFailed.value = isWizardLocked.value && !wizardEventValid.value
    initConfigTable()
    return false
  }
  existingConfigLoading.value = true
  try {
    let existingEvent
    if (isWizardLocked.value) {
      existingEvent = await eventAPI.getDetail(props.wizardEvent.id)
      assertLockedEvent(existingEvent)
    } else {
      const response = await eventAPI.getList({ page: 1, page_size: 1, year: formData.value.year, season: formData.value.season })
      if (!Array.isArray(response?.items)) throw new Error('赛事查询结果无效，请重试')
      existingEvent = response.items?.[0]
      if (existingEvent && (existingEvent.year !== formData.value.year || existingEvent.season !== formData.value.season || (!Number.isSafeInteger(existingEvent.id) || existingEvent.id <= 0))) {
        throw new Error('赛事查询结果不一致，请重试')
      }
    }
    if (disposed || version !== configurationLoadVersion) return false
    if (existingEvent) {
      existingEventId.value = existingEvent.id
      if (!isCreateWizard.value) {
        if (!Array.isArray(existingEvent.configurations)) throw new Error('赛事配置读取不完整，请重试')
        loadedConfigurations.value = existingEvent.configurations
        applyConfigurationsToTable(existingEvent.configurations)
      }
    } else {
      existingEventId.value = null
      loadedConfigurations.value = []
      initConfigTable()
      applyRegistrationCountsToTable(existingRegistrations.value)
    }
    existingConfigLoadFailed.value = false
    eventLookupComplete.value = true
    return true
  } catch (error) {
    if (disposed || version !== configurationLoadVersion) return false
    existingEventId.value = null
    console.error('加载已存在赛事配置失败:', error)
    existingConfigLoadFailed.value = true
    formMsg.show('error', error.message || '加载历史赛事配置失败，请重试')
    initConfigTable()
    if (!isTeamsWizard.value) applyRegistrationCountsToTable(existingRegistrations.value)
    return false
  } finally {
    if (!disposed && version === configurationLoadVersion) existingConfigLoading.value = false
  }
}

const assertManagedDetail = detail => {
  const pinned = managedEvent.value
  if (!managedId.value || detail?.id !== managedId.value || !Number.isSafeInteger(detail.year) || detail.year <= 0 ||
      !['春季赛', '夏季赛', '秋季赛', '冬季赛'].includes(detail.season) || (pinned && (detail.year !== pinned.year || detail.season !== pinned.season))) {
    throw new Error('赛事编号或身份与指定赛事不一致')
  }
  if (!Array.isArray(detail.configurations) || detail.configurations.some(item => !Number.isSafeInteger(item.id) || item.id <= 0 || item.event_id !== managedId.value)) throw new Error('赛事配置读取不完整或归属不一致')
}
const loadManagedEvent = async () => {
  if (!isManaged.value || disposed || wizardBusy.value) return
  const version = ++configurationLoadVersion
  managedError.value = ''
  managedEvent.value = null
  existingEventId.value = null
  existingRegistrations.value = []
  registrationsLoaded.value = false
  eventLookupComplete.value = false
  if (!managedId.value) { managedError.value = '赛事编号必须为有效的正整数'; existingConfigLoadFailed.value = true; return }
  if (!dictionaryReady.value || dictionaryLoadFailed.value) { managedError.value = '请先成功加载表单字典'; return }
  existingConfigLoading.value = true
  try {
    const detail = await eventAPI.getDetail(managedId.value)
    if (disposed || version !== configurationLoadVersion) return
    assertManagedDetail(detail)
    managedEvent.value = { id: detail.id, year: detail.year, season: detail.season }
    formData.value.year = detail.year
    formData.value.season = detail.season
    existingEventId.value = detail.id
    loadedConfigurations.value = detail.configurations
    applyConfigurationsToTable(detail.configurations)
    const loaded = await loadExistingRegistrations()
    if (!loaded) throw new Error('指定赛事报名读取不完整，请重试')
    existingConfigLoadFailed.value = false
    eventLookupComplete.value = true
  } catch (error) {
    if (disposed || version !== configurationLoadVersion) return
    managedError.value = error?.detail || error?.message || '无法加载指定赛事'
    existingConfigLoadFailed.value = true
    existingEventId.value = null
    managedEvent.value = null
    existingRegistrations.value = []
    initConfigTable()
  } finally { if (!disposed && version === configurationLoadVersion) existingConfigLoading.value = false }
}

const loadSelectedEvent = () => {
  if (isManaged.value) return loadManagedEvent()
  if (isCreateWizard.value) return loadExistingEventConfigurations()
  if (!dictionaryReady.value) return
  return Promise.all([
    loadExistingEventConfigurations(),
    ...(!isTeamsWizard.value ? [loadExistingRegistrations()] : []),
  ])
}

const loadDictionaries = async () => {
  dictionaryLoading.value = true
  dictionaryReady.value = false
  try {
    await fetchDictionaries()
    if (disposed) return
    initConfigTable()
    applyRegistrationCountsToTable(existingRegistrations.value)
    dictionaryLoadFailed.value = false
    dictionaryReady.value = true
  } catch (error) {
    if (disposed) return
    console.error('加载字典数据失败:', error)
    dictionaryLoadFailed.value = true
    formMsg.show('error', '加载表单数据失败，请重试')
  } finally {
    if (!disposed) dictionaryLoading.value = false
  }
  if (!disposed && dictionaryReady.value) await loadSelectedEvent()
}

onMounted(() => {
  if (isCreateWizard.value) loadSelectedEvent()
  else loadDictionaries()
})

watch(() => [formData.value.year, formData.value.season], () => {
  if (disposed) return
  if (isManaged.value) {
    if (managedEvent.value) { formData.value.year = managedEvent.value.year; formData.value.season = managedEvent.value.season }
    return
  }
  loadSelectedEvent()
})

watch(
  () => [formData.value.year, formData.value.season],
  () => {
    registrationBatch.value = []
    registrationUploadedFileName.value = ''
    registrationParseMsg.clear()
    if (registrationFileInput.value) {
      registrationFileInput.value.value = ''
    }
  }
)

// 将表格数据转换为配置数组
const buildConfigurations = () => {
  const configs = []
  bowTypes.value.forEach(bowType => {
    getBowTypeDistances(bowType.code).forEach(distance => {
      competitionGenderGroups.value.forEach(genderGroup => {
        const counts = configTable.value[genderGroup.code]?.[bowType.code]?.[distance.code]
        if (!counts) return

        const individual = Number(counts.individual_participant_count || 0)
        const team = Number(counts.team_count || 0)
        const mixed = genderGroup.code === sharedGenderGroupCode
          ? Number(configTable.value[sharedGenderGroupCode]?.[bowType.code]?.[distance.code]?.mixed_doubles_team_count || 0)
          : 0

        if (isTeamsWizard.value || individual > 0 || mixed > 0 || team > 0) {
          configs.push({
            gender_group: genderGroup.code,
            bow_type: bowType.code,
            distance: distance.code,
            individual_participant_count: individual,
            mixed_doubles_team_count: mixed,
            team_count: team
          })
        }
      })
    })
  })
  return configs
}

const syncExistingEventConfigurations = async (eventId, configurations) => {
  const detail = await eventAPI.getDetail(eventId)
  if (disposed) return
  if (isManaged.value) assertManagedDetail(detail)
  if (!isWizard.value && !isManaged.value && (detail?.id !== eventId || detail.year !== formData.value.year || detail.season !== formData.value.season || !Array.isArray(detail.configurations))) throw new Error('已有赛事身份或配置读取不一致，请重试')
  if (!isWizard.value && configurations.length === 0 && detail.configurations?.length) throw new Error('不能用空配置覆盖已有赛事，请保留必要配置')
  if (isTeamsWizard.value) {
    assertLockedEvent(detail)
    if (!Array.isArray(detail.configurations)) throw new Error('赛事配置读取不完整，请重试')
    // Fresh detail on every retry: keep individual counts and all unlisted historical combinations.
    const existing = new Map(detail.configurations.map(item => [
      [item.gender_group, item.bow_type, item.distance].join('|'), item,
    ]))
    const tasks = []
    for (const config of configurations) {
      const previous = existing.get([config.gender_group, config.bow_type, config.distance].join('|'))
      const counts = { team_count: config.team_count, mixed_doubles_team_count: config.mixed_doubles_team_count }
      if (previous) tasks.push(eventConfigAPI.update(previous.id, counts))
      else if (counts.team_count > 0 || counts.mixed_doubles_team_count > 0) {
        tasks.push(eventConfigAPI.create({ event_id: eventId, ...config, individual_participant_count: 0 }))
      }
    }
    const results = await Promise.allSettled(tasks)
    const failure = results.find(result => result.status === 'rejected')
    if (failure) throw failure.reason
    return
  }
  const existingConfigs = detail.configurations || []

  const existingMap = new Map(
    existingConfigs.map(item => [`${item.gender_group}|${item.bow_type}|${item.distance}`, item])
  )
  const newMap = new Map(
    configurations.map(item => [`${item.gender_group}|${item.bow_type}|${item.distance}`, item])
  )

  const updateOrCreateTasks = []

  newMap.forEach((config, key) => {
    const existing = existingMap.get(key)
    if (existing) {
      updateOrCreateTasks.push(
        eventConfigAPI.update(existing.id, {
          individual_participant_count: config.individual_participant_count,
          mixed_doubles_team_count: config.mixed_doubles_team_count,
          team_count: config.team_count
        })
      )
    } else {
      updateOrCreateTasks.push(
        eventConfigAPI.create({
          event_id: eventId,
          gender_group: config.gender_group,
          bow_type: config.bow_type,
          distance: config.distance,
          individual_participant_count: config.individual_participant_count,
          mixed_doubles_team_count: config.mixed_doubles_team_count,
          team_count: config.team_count
        })
      )
    }
  })

  const deleteTasks = []
  existingMap.forEach((existing, key) => {
    if (!newMap.has(key)) {
      if (isManaged.value && (!competitionGenderGroups.value.some(item => item.code === existing.gender_group) || !getBowTypeDistances(existing.bow_type).some(item => item.code === existing.distance))) return
      deleteTasks.push(eventConfigAPI.delete(existing.id))
    }
  })

  const results = await Promise.allSettled([...updateOrCreateTasks, ...deleteTasks])
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
}

const getBowTypeLabel = (type) => {
  const found = bowTypes.value.find(item => item.code === type)
  return found ? found.name : type || '-'
}

const getDistanceLabel = (distance) => {
  const found = distances.value.find(item => item.code === distance)
  return found ? found.name : distance || '-'
}

const getGenderGroupLabel = (groupCode) => {
  const found = competitionGenderGroups.value.find(item => item.code === groupCode)
  return found ? found.name : groupCode || '-'
}

const validRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid).length)
const invalidRegistrationCount = computed(() => registrationBatch.value.filter(item => !item.__valid).length)
const duplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate).length)
const inFileDuplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_in_file).length)
const inFileDuplicateRegistrationToRemoveCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length)
const existingDuplicateRegistrationCount = computed(() => registrationBatch.value.filter(item => item.__valid && item.__duplicate_with_existing).length)
const isRegistrationPreviewDuplicate = (item) => {
  return Boolean(item?.__valid && (item.__duplicate || item.__duplicate_in_file || item.__duplicate_with_existing))
}
const registrationPreviewSections = computed(() => {
  const indexedItems = registrationBatch.value.map((item, index) => ({ item, index }))
  return [
    {
      key: 'error',
      title: '异常记录',
      emptyText: '没有异常记录',
      items: indexedItems.filter(({ item }) => !item.__valid),
    },
    {
      key: 'duplicate',
      title: '重复记录',
      emptyText: '没有重复记录',
      items: indexedItems.filter(({ item }) => isRegistrationPreviewDuplicate(item)),
    },
    {
      key: 'normal',
      title: '正常记录',
      emptyText: '没有正常记录',
      items: indexedItems.filter(({ item }) => item.__valid && !isRegistrationPreviewDuplicate(item)),
    },
  ]
})

const parseRegistrationExcelData = (jsonData) => {
  registrationParseMsg.clear()

  const result = parseRegistrationImportData({
    jsonData,
    bowTypes: bowTypes.value,
    distances: distances.value,
    competitionGenderGroups: competitionGenderGroups.value,
    existingRegistrations: existingRegistrations.value,
    selectedYear: formData.value.year,
    selectedSeason: formData.value.season,
  })

  if (result.errorMessage) {
    registrationParseMsg.errorMsg.value = result.errorMessage
    return
  }

  registrationBatch.value = result.registrations
  registrationParseMsg.successMsg.value = result.successMessage
}

const onRegistrationFileSelected = async (event) => {
  if (registrationParsing.value || registrationImportLoading.value || (isWizard.value ? !wizardReady.value : !pageReady.value)) return
  const file = event.target.files?.[0]
  if (!file) return

  const version = ++fileReadVersion
  registrationBatch.value = []
  registrationUploadedFileName.value = file.name
  registrationParseMsg.clear()

  const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls')
  if (!isExcel) {
    registrationParseMsg.errorMsg.value = '请上传 .xlsx 或 .xls 格式的文件'
    return
  }

  registrationParsing.value = true
  const reader = new FileReader()
  reader.onerror = reader.onabort = () => {
    if (disposed || version !== fileReadVersion) return
    registrationParseMsg.errorMsg.value = '文件读取失败，请重试'
    registrationParsing.value = false
  }

  if (isExcel) {
    reader.onload = async (e) => {
      try {
        const XLSX = await import('xlsx')
        if (disposed || version !== fileReadVersion) return
        const data = new Uint8Array(e.target.result)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })
        parseRegistrationExcelData(jsonData)
      } catch (error) {
        if (!disposed && version === fileReadVersion) registrationParseMsg.errorMsg.value = 'Excel 文件解析失败：' + error.message
      } finally {
        if (!disposed && version === fileReadVersion) registrationParsing.value = false
      }
    }
    try {
      reader.readAsArrayBuffer(file)
    } catch (error) {
      registrationParseMsg.errorMsg.value = '文件读取失败：' + error.message
      registrationParsing.value = false
    }
    return
  }
}

const removeRegistrationBatchItem = (index) => {
  registrationBatch.value = recalculateRegistrationDuplicateFlags(
    registrationBatch.value.filter((_, itemIndex) => itemIndex !== index),
    existingRegistrations.value
  )
}

const clearRegistrationDraft = () => {
  if (wizardBusy.value) return
  registrationBatch.value = []
  registrationUploadedFileName.value = ''
  registrationParseMsg.clear()
  if (registrationFileInput.value) registrationFileInput.value.value = ''
}

const useExistingRegistrations = () => {
  if (!wizardReady.value || !existingRegistrations.value.length || registrationBatch.value.length ||
      registrationUploadedFileName.value || registrationParseMsg.errorMsg.value) return
  emit('complete')
}

const submitRegistrationImport = async () => {
  if (registrationImportLoading.value || registrationParsing.value) return
  if (isWizard.value ? !wizardReady.value : !pageReady.value) {
    formMsg.show('error', '请等待赛事和报名完整加载成功后再导入')
    return
  }
  if (!formData.value.season) {
    formMsg.show('error', '请先选择赛季')
    return
  }

  if (registrationBatch.value.length === 0) {
    registrationParseMsg.errorMsg.value = '请先上传并解析报名文件'
    return
  }

  if (invalidRegistrationCount.value > 0) {
    registrationParseMsg.errorMsg.value = `当前有 ${invalidRegistrationCount.value} 条异常数据，请删除或修正后再导入。`
    return
  }

  let completed = false
  registrationImportLoading.value = true
  registrationParseMsg.clear()

  try {
    const validRegistrations = registrationBatch.value
      .filter(item => item.__valid && !item.__duplicate_in_file_to_remove)
      .map(item => ({
        year: isManaged.value ? managedEvent.value.year : isWizardLocked.value ? props.wizardEvent.year : item.year,
        season: isManaged.value ? managedEvent.value.season : isWizardLocked.value ? props.wizardEvent.season : item.season,
        name: item.name,
        club: item.club,
        distance: item.distance,
        competition_bow_type: item.competition_bow_type,
        points_bow_type: item.points_bow_type,
        competition_gender_group: item.competition_gender_group,
      }))

    const dedupedRegistrationMap = new Map()
    validRegistrations.forEach(item => {
      dedupedRegistrationMap.set(buildRegistrationUniqueKey(item), item)
    })
    const submittedRegistrations = Array.from(dedupedRegistrationMap.values())

    await eventRegistrationAPI.batchImport({ registrations: submittedRegistrations })
    if (disposed) return

    if (duplicateRegistrationCount.value > 0) {
      formMsg.show(
        'success',
        `成功导入 ${submittedRegistrations.length} 条报名（原始合法 ${validRegistrationCount.value} 条）；其中与已有报名重复 ${existingDuplicateRegistrationCount.value} 条（覆盖更新），文件内重复 ${inFileDuplicateRegistrationCount.value} 条（已移除 ${inFileDuplicateRegistrationToRemoveCount.value} 条）`
      )
    } else {
      formMsg.show('success', `成功导入 ${submittedRegistrations.length} 条报名`)
    }

    registrationBatch.value = []
    registrationUploadedFileName.value = ''
    if (registrationFileInput.value) {
      registrationFileInput.value.value = ''
    }
    if (!isRegistrationsWizard.value) await handleRegistrationsChanged()
    completed = true
  } catch (error) {
    if (disposed) return
    let errorMsg = error?.detail || error?.message || '报名导入失败，请重试'

    if (Array.isArray(error?.detail)) {
      errorMsg = error.detail.map(item => item.msg || '验证失败').join('；')
    }

    formMsg.show('error', errorMsg)
    console.error('Error importing registrations:', error)
  } finally {
    registrationImportLoading.value = false
  }
  if (completed && isRegistrationsWizard.value && !disposed) emit('complete')
}

const handleRegistrationsChanged = async () => {
  await loadExistingRegistrations()
  await loadExistingEventConfigurations()
}

const createWizardEvent = async () => {
  if (!wizardReady.value || loading.value) return
  if (!Number.isInteger(formData.value.year) || formData.value.year < 2000 || formData.value.year > 2100 ||
      !['春季赛', '夏季赛', '秋季赛', '冬季赛'].includes(formData.value.season)) {
    formMsg.show('error', '请填写有效的年度和赛季')
    return
  }
  let completedEvent
  loading.value = true
  formMsg.clear()
  try {
    if (existingEventId.value) {
      completedEvent = { id: existingEventId.value, year: formData.value.year, season: formData.value.season }
    } else {
      const result = await eventAPI.createWithConfigs({ year: formData.value.year, season: formData.value.season, configurations: [] })
      if (!Number.isSafeInteger(result?.id) || result.id <= 0 || result.year !== formData.value.year || result.season !== formData.value.season) {
        throw new Error('创建赛事返回信息不完整，请刷新确认后再继续')
      }
      completedEvent = { id: result.id, year: result.year, season: result.season }
    }
  } catch (error) {
    if (!disposed) formMsg.show('error', error?.detail || error?.message || '创建赛事失败，请重试')
  } finally {
    loading.value = false
  }
  if (completedEvent && !disposed) emit('complete', completedEvent)
}

const validateTeamCounts = () => {
  for (const group of Object.values(configTable.value)) {
    for (const bow of Object.values(group)) {
      for (const counts of Object.values(bow)) {
        for (const value of [counts.team_count, counts.mixed_doubles_team_count]) {
          const number = value === '' || value == null ? 0 : Number(value)
          if (!Number.isSafeInteger(number) || number < 0 || number > 2147483647) {
            throw new Error('团体和混双队伍数必须为非负整数，且不得超过2147483647')
          }
        }
      }
    }
  }
}

const submitForm = async () => {
  if (!isWizard.value && savedPage.value) return returnToEventList()
  if (isCreateWizard.value) return createWizardEvent()
  if (isRegistrationsWizard.value) return submitRegistrationImport()
  if (disposed || loading.value || (isWizard.value ? !wizardReady.value : !pageReady.value)) return
  if (isTeamsWizard.value || !isWizard.value) {
    try { validateTeamCounts() } catch (error) { formMsg.show('error', error.message); return }
  }
  if (!formData.value.season) {
    formMsg.show('error', '请选择赛季')
    return
  }

  const configurations = buildConfigurations()
  
  if (configurations.length === 0 && !isWizard.value && existingEventId.value && loadedConfigurations.value.length) {
    formMsg.show('error', '不能用空配置覆盖已有赛事，请保留必要配置')
    return
  }

  let completed = false
  loading.value = true
  formMsg.clear()

  try {
    const payload = {
      year: isManaged.value ? managedEvent.value.year : isWizardLocked.value ? props.wizardEvent.year : formData.value.year,
      season: isManaged.value ? managedEvent.value.season : isWizardLocked.value ? props.wizardEvent.season : formData.value.season,
      configurations
    }

    if (existingEventId.value) {
      await syncExistingEventConfigurations(existingEventId.value, configurations)
      if (disposed) return
      formMsg.show('success', '赛事配置更新成功')
    } else {
      if (isManaged.value) throw new Error('指定赛事未通过身份校验，禁止创建其他赛事')
      const created = await eventAPI.createWithConfigs(payload)
      if (disposed) return
      if (!Number.isSafeInteger(created?.id) || created.id <= 0 || created.year !== payload.year || created.season !== payload.season) throw new Error('创建赛事返回信息不完整，请刷新赛事清单确认')
      formMsg.show('success', '赛事添加成功')
    }

    completed = true
    if (!isWizard.value && !disposed) { savedPage.value = true; await returnToEventList() }
  } catch (error) {
    if (disposed) return
    if (isManaged.value) { managedError.value = error?.detail || error?.message || '配置保存失败，请重新加载确认'; existingConfigLoadFailed.value = true; eventLookupComplete.value = false }
    formMsg.show('error', error?.detail || error.message || (existingEventId.value ? '更新失败，请重试' : '添加失败，请重试'))
    console.error('Error saving event config:', error)
  } finally {
    loading.value = false
  }
  if (completed && isTeamsWizard.value && !disposed) emit('complete')
}
</script>

<style scoped lang="scss" src="@/styles/EventAdd.scss" />

<style scoped lang="scss">
.event-add-page.wizard-mode {
  padding-bottom: 0;
  background: transparent;

  .form-container { padding: 0; }
  .form-actions { padding-left: 0; padding-right: 0; }
  .wizard-loading { color: #666; font-size: 13px; }
  .wizard-registration-actions { flex-wrap: wrap; }
  .wizard-registration-actions .btn-cancel {
    padding: 10px 14px;
    border: 0;
    border-radius: 6px;
    background: #f0f0f0;
    color: #333;
    cursor: pointer;
  }
  button:disabled { opacity: 0.6; cursor: not-allowed; }

  .team-config-list { display: grid; gap: 20px; }
  .team-distance-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 250px), 1fr));
    gap: 10px 12px;
  }
  .team-distance-card {
    min-width: 0;
    margin: 0;
    padding: 9px 12px 12px;
    background: #f8f9ff;
    border: 1px solid #dce2f4;
    border-radius: 8px;
  }
  .team-distance-card legend { padding: 0 4px; color: #333; font-size: 14px; font-weight: 600; }
  .team-distance-group { margin-left: 4px; color: #586497; font-size: 12px; }
  .team-count-fields { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; }
  .team-count-field { display: grid; min-width: 0; gap: 4px; color: #333; font-size: 13px; }
  .team-count-input {
    width: 100%;
    min-width: 0;
    min-height: 44px;
    padding: 8px;
    border: 1px solid #cdd6e9;
    border-radius: 6px;
    background: #fff;
    color: #333;
    font: inherit;
    font-size: 16px;
    font-variant-numeric: tabular-nums;
    text-align: center;
  }
  .team-count-input:focus-visible { outline: 2px solid #667eea; outline-offset: 1px; }
  .team-count-input:disabled { background: #eff1f7; color: #666; cursor: not-allowed; }
}
</style>
