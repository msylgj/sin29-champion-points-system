<template>
  <main class="wizard-page safe-area">
    <header class="wizard-header">
      <h1>成绩导入向导</h1>
      <p>按步骤完成一场赛事的报名、配置与成绩录入</p>
    </header>

    <div class="wizard-container">
      <section class="wizard-card" aria-label="成绩导入向导进度">
        <ol class="wizard-steps">
          <li v-for="(title, index) in steps" :key="title"
            :class="{ current: index === step, done: index < step }"
            :aria-current="index === step ? 'step' : undefined">
            <span>{{ index + 1 }}</span>{{ title }}
          </li>
        </ol>
        <p v-if="event" class="event-summary">当前赛事：<strong>{{ event.year }}年 {{ event.season }}</strong></p>
      </section>

      <section class="wizard-work" aria-labelledby="wizard-step-title">
        <h2 id="wizard-step-title" ref="stepTitle" tabindex="-1">{{ step + 1 }} / {{ steps.length }} · {{ steps[step] }}</h2>
        <EventAdd v-if="step === 0" key="event" wizard-mode="create" :wizard-event="event"
          @complete="selectEvent" @busy-change="setBusy(0, $event)" />
        <EventAdd v-else-if="step === 1" key="registrations" wizard-mode="registrations" :wizard-event="event"
          @complete="completeStep(1)" @busy-change="setBusy(1, $event)" />
        <WizardCoverage v-else-if="step === 2" key="registration-review" kind="registrations" :event="event"
          @ready="setReviewReady(2, $event)" />
        <EventAdd v-else-if="step === 3" key="teams" wizard-mode="teams" :wizard-event="event"
          @complete="completeStep(3)" @busy-change="setBusy(3, $event)" />
        <ScoreImport v-else-if="step === 4" key="scores" :wizard-event="event"
          @complete="completeStep(4)" @busy-change="setBusy(4, $event)" />
        <WizardCoverage v-else key="score-review" kind="scores" :event="event" @ready="setReviewReady(5, $event)" />
      </section>

      <footer class="wizard-card wizard-actions">
        <button v-if="step === 0" type="button" class="btn-secondary" :disabled="busy || leaving"
          @click="leave('/event-list')">返回赛事清单</button>
        <button v-else type="button" class="btn-secondary" :disabled="busy || leaving" @click="goTo(step - 1)">上一步</button>
        <button v-if="step === 2" type="button" class="btn-primary" :disabled="!reviewReady" @click="completeStep(2)">核查完毕，下一步</button>
        <button v-if="step === 5" type="button" class="btn-primary" :disabled="!reviewReady || leaving" @click="leave('/points-display')">完成并返回积分页</button>
        <p v-if="navigationError" class="wizard-error" role="alert">未能离开向导，请重试。</p>
      </footer>
    </div>
  </main>
</template>

<script setup>
import { nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import EventAdd from './EventAdd.vue'
import ScoreImport from './ScoreImport.vue'
import WizardCoverage from '@/components/WizardCoverage.vue'

const steps = ['创建比赛', '导入报名表', '核查报名', '编辑队伍数量', '上传成绩表', '核查成绩']
const router = useRouter()
const step = ref(0)
const stepTitle = ref(null)
const event = ref(null)
const busy = ref(false)
const reviewReady = ref(false)
const leaving = ref(false)
const navigationError = ref(false)

function goTo(target) {
  step.value = target
  busy.value = false
  reviewReady.value = false
  navigationError.value = false
  nextTick(() => {
    stepTitle.value?.focus({ preventScroll: true })
    stepTitle.value?.scrollIntoView?.({ block: 'start' })
  })
}

function selectEvent(selected) {
  if (step.value !== 0 || !selected?.id || !selected.year || !selected.season) return
  event.value = { id: selected.id, year: selected.year, season: selected.season }
  goTo(1)
}

function setBusy(from, pending) {
  if (step.value === from) busy.value = !!pending
}

function setReviewReady(from, ready) {
  if (step.value === from) reviewReady.value = !!ready
}

function completeStep(from) {
  if (step.value !== from || (from === 2 && !reviewReady.value)) return
  goTo(from + 1)
}

async function leave(path) {
  if (busy.value || leaving.value || (path === '/points-display' && (step.value !== 5 || !reviewReady.value))) return
  leaving.value = true
  navigationError.value = false
  try {
    navigationError.value = !!(await router.replace(path))
  } catch {
    navigationError.value = true
  } finally {
    leaving.value = false
  }
}
</script>

<style scoped lang="scss" src="@/styles/WorkWizard.scss" />
