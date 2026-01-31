<template>
  <div class="score-form-page safe-area">
    <!-- 顶部栏 -->
    <div class="form-header">
      <button @click="goBack" class="btn-back">← 返回</button>
      <h1>{{ isEdit ? '编辑成绩' : '录入成绩' }}</h1>
      <div style="width: 44px;"></div>
    </div>

    <!-- 表单 -->
    <form @submit.prevent="submitForm" class="score-form">
      <!-- 基本信息 -->
      <div class="form-section">
        <div class="section-title">基本信息</div>

        <div class="form-group">
          <label>年度 *</label>
          <select v-model.number="formData.year" class="form-input" required>
            <option value="">请选择年度</option>
            <option v-for="year in years" :key="year" :value="year">{{ year }}</option>
          </select>
          <span v-if="errors.year" class="error">{{ errors.year }}</span>
        </div>

        <div class="form-group">
          <label>季度 *</label>
          <select v-model="formData.season" class="form-input" required>
            <option value="">请选择季度</option>
            <option value="Q1">Q1</option>
            <option value="Q2">Q2</option>
            <option value="Q3">Q3</option>
            <option value="Q4">Q4</option>
          </select>
          <span v-if="errors.season" class="error">{{ errors.season }}</span>
        </div>
      </div>

      <!-- 赛事信息 -->
      <div class="form-section">
        <div class="section-title">赛事信息</div>

        <div class="form-group">
          <label>距离 *</label>
          <select v-model="formData.distance" class="form-input" required>
            <option value="">请选择距离</option>
            <option value="18m">18m</option>
            <option value="30m">30m</option>
            <option value="50m">50m</option>
            <option value="70m">70m</option>
          </select>
          <span v-if="errors.distance" class="error">{{ errors.distance }}</span>
        </div>

        <div class="form-group">
          <label>赛制 *</label>
          <select v-model="formData.competition_format" class="form-input" required>
            <option value="">请选择赛制</option>
            <option value="ranking">排名赛</option>
            <option value="elimination">淘汰赛</option>
            <option value="team">团体赛</option>
          </select>
          <span v-if="errors.competition_format" class="error">{{ errors.competition_format }}</span>
        </div>

        <div class="form-group">
          <label>性别分组 *</label>
          <select v-model="formData.gender_group" class="form-input" required>
            <option value="">请选择性别分组</option>
            <option value="male">男</option>
            <option value="female">女</option>
            <option value="mixed">混合</option>
          </select>
          <span v-if="errors.gender_group" class="error">{{ errors.gender_group }}</span>
        </div>

        <div class="form-group">
          <label>弓种</label>
          <select v-model="formData.bow_type" class="form-input">
            <option value="">请选择弓种</option>
            <option value="recurve">反曲弓</option>
            <option value="compound">复合弓</option>
            <option value="longbow">长弓</option>
          </select>
        </div>
      </div>

      <!-- 成绩信息 -->
      <div class="form-section">
        <div class="section-title">成绩信息</div>

        <div class="form-group">
          <label>原始成绩 *</label>
          <input
            v-model.number="formData.raw_score"
            type="number"
            class="form-input"
            placeholder="请输入原始成绩"
            required
          />
          <span v-if="errors.raw_score" class="error">{{ errors.raw_score }}</span>
        </div>

        <div class="form-group">
          <label>排名 *</label>
          <input
            v-model.number="formData.rank"
            type="number"
            class="form-input"
            placeholder="请输入排名"
            min="1"
            required
          />
          <span v-if="errors.rank" class="error">{{ errors.rank }}</span>
        </div>

        <div class="form-group">
          <label>参赛人数 *</label>
          <input
            v-model.number="formData.participant_count"
            type="number"
            class="form-input"
            placeholder="请输入参赛人数"
            min="1"
            required
          />
          <span v-if="errors.participant_count" class="error">{{ errors.participant_count }}</span>
        </div>
      </div>

      <!-- 计算结果预览 -->
      <div v-if="calculatedPoints !== null" class="form-section">
        <div class="section-title">积分预览</div>
        <div class="points-preview">
          <div class="preview-label">预计积分</div>
          <div class="preview-value">{{ formatPoints(calculatedPoints) }}</div>
          <div class="preview-hint">系统将自动计算最终积分</div>
        </div>
      </div>

      <!-- 按钮 -->
      <div class="form-actions">
        <button type="button" @click="goBack" class="btn-cancel">取消</button>
        <button type="submit" class="btn-submit" :disabled="submitting">
          {{ submitting ? '提交中...' : '提交' }}
        </button>
      </div>
    </form>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useScoresStore } from '@/stores/scores'
import { validate, scoreFormRules } from '@/utils/validation'
import { formatPoints } from '@/utils/formatter'

const router = useRouter()
const route = useRoute()
const scoresStore = useScoresStore()

const isEdit = computed(() => !!route.params.id)

const years = computed(() => {
  const year = new Date().getFullYear()
  return [year - 1, year, year + 1]
})

const formData = ref({
  year: new Date().getFullYear(),
  season: '',
  distance: '',
  competition_format: '',
  gender_group: '',
  bow_type: '',
  raw_score: '',
  rank: '',
  participant_count: ''
})

const errors = ref({})
const submitting = ref(false)

const calculatedPoints = computed(() => {
  // 简单的积分计算预览
  if (formData.value.rank && formData.value.participant_count) {
    const rankPoints = {
      1: 25, 2: 22, 3: 19, 4: 15, 5: 10,
      6: 8, 7: 6, 8: 4, 9: 1
    }
    const basePoints = rankPoints[formData.value.rank] || 1
    const count = formData.value.participant_count
    
    let coefficient = 0.6
    if (count >= 128) coefficient = 1.4
    else if (count >= 64) coefficient = 1.2
    else if (count >= 32) coefficient = 1.0
    else if (count >= 16) coefficient = 0.8

    let points = basePoints * coefficient
    if (formData.value.distance === '18m') points *= 0.5
    
    return points
  }
  return null
})

const goBack = () => {
  router.back()
}

const submitForm = async () => {
  // 验证表单
  const validationErrors = validate(formData.value, scoreFormRules)
  if (Object.keys(validationErrors).length > 0) {
    errors.value = validationErrors
    return
  }

  submitting.value = true
  try {
    if (isEdit.value) {
      await scoresStore.updateScore(route.params.id, formData.value)
    } else {
      await scoresStore.createScore(formData.value)
    }
    
    // 提示成功并返回
    alert(isEdit.value ? '成绩更新成功!' : '成绩录入成功!')
    router.push('/scores')
  } catch (error) {
    alert('操作失败，请重试')
    console.error(error)
  } finally {
    submitting.value = false
  }
}

onMounted(async () => {
  if (isEdit.value) {
    const score = await scoresStore.fetchScoreDetail(route.params.id)
    if (score) {
      formData.value = {
        ...score,
        year: score.year,
        season: score.season,
        distance: score.distance,
        competition_format: score.competition_format,
        gender_group: score.gender_group,
        bow_type: score.bow_type,
        raw_score: score.raw_score,
        rank: score.rank,
        participant_count: score.participant_count
      }
    }
  }
})
</script>

<style scoped lang="scss">
.score-form-page {
  display: flex;
  flex-direction: column;
  padding-bottom: var(--spacing-2xl);
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: var(--spacing-lg);
  background: var(--white);
  margin-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--gray-light);

  h1 {
    font-size: var(--font-h3);
    margin: 0;
  }

  .btn-back {
    background: none;
    border: none;
    font-size: var(--font-body);
    color: var(--primary);
    cursor: pointer;
    padding: 0;
  }
}

.score-form {
  padding: 0 var(--spacing-lg);

  .form-section {
    margin-bottom: var(--spacing-2xl);

    .section-title {
      font-size: var(--font-h4);
      font-weight: 600;
      margin-bottom: var(--spacing-lg);
      color: var(--dark);
    }
  }

  .form-group {
    margin-bottom: var(--spacing-lg);

    label {
      display: block;
      font-size: var(--font-small);
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
      color: var(--dark);
    }

    .form-input {
      width: 100%;
      padding: var(--spacing-md);
      border: 1px solid var(--gray-light);
      border-radius: var(--radius-md);
      font-size: var(--font-body);
      background: var(--white);

      &:focus {
        outline: none;
        border-color: var(--primary);
        background-color: var(--primary-light);
      }
    }

    .error {
      display: block;
      color: var(--danger);
      font-size: var(--font-xs);
      margin-top: var(--spacing-xs);
    }
  }

  .points-preview {
    background: var(--primary-light);
    padding: var(--spacing-lg);
    border-radius: var(--radius-md);
    text-align: center;

    .preview-label {
      font-size: var(--font-small);
      color: var(--primary);
      margin-bottom: var(--spacing-md);
    }

    .preview-value {
      font-size: var(--font-h1);
      color: var(--primary);
      font-weight: 600;
      margin-bottom: var(--spacing-md);
    }

    .preview-hint {
      font-size: var(--font-xs);
      color: var(--dark-gray);
    }
  }

  .form-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-2xl);

    button {
      padding: var(--spacing-lg);
      border: none;
      border-radius: var(--radius-md);
      font-size: var(--font-body);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
    }

    .btn-cancel {
      background: var(--light);
      color: var(--dark);
      border: 1px solid var(--gray-light);

      &:active {
        background: var(--gray-light);
      }
    }

    .btn-submit {
      background: var(--primary);
      color: var(--white);

      &:active {
        background: var(--primary-dark);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
  }
}

@media (min-width: 768px) {
  .score-form-page {
    max-width: 600px;
    margin: 0 auto;
  }

  .score-form {
    padding: 0;
  }
}
</style>
