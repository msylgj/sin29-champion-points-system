<template>
  <div v-if="readonly" class="rule-readonly">
    <p class="readonly-note">规则配置（只读）：单项乘算后四舍五入保留 {{ config.precision }} 位小数，再汇总已舍入分项。团体与混双共用积分和人数系数。</p>
    <div class="rule-readonly-tables">
      <div v-for="table in pointTables" :key="table.key" class="readonly-table-block">
        <table>
          <caption>{{ table.label }}排名积分</caption>
          <thead><tr><th scope="col">名次</th><th scope="col">基础积分</th></tr></thead>
          <tbody>
            <tr v-for="(points, index) in config[table.key]" :key="index"><th scope="row">{{ index + 1 }}</th><td>{{ points }}</td></tr>
          </tbody>
        </table>
      </div>
      <div v-for="table in coefficientTables" :key="table.key" class="readonly-table-block readonly-coefficients">
        <table>
          <caption>{{ table.label }}人数系数</caption>
          <thead><tr><th scope="col">人数区间</th><th scope="col">系数</th><th scope="col">计分名次上限</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in config[table.key]" :key="index">
              <th scope="row">{{ row.min_count }}–{{ row.max_count ?? '无上限' }}</th><td>{{ row.coefficient }}</td><td>{{ row.cutoff }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div class="readonly-table-block">
        <table>
          <caption>组别系数</caption>
          <thead><tr><th scope="col">组别</th><th scope="col">系数</th></tr></thead>
          <tbody>
            <tr v-for="group in groups" :key="group"><th scope="row">{{ group }}</th><td>{{ config.group_multipliers[group] }}</td></tr>
          </tbody>
        </table>
      </div>
      <div class="readonly-table-block readonly-snapshot">
        <table>
          <caption>弓种 / 距离组别快照</caption>
          <thead><tr><th scope="col">弓种</th><th scope="col">距离</th><th scope="col">组别</th></tr></thead>
          <tbody>
            <tr v-for="(row, index) in config.competition_groups" :key="index">
              <td>{{ bowNames.get(row.bow_type) || row.bow_type }}</td>
              <td>{{ distanceNames.get(row.distance) || row.distance }}</td><td>{{ row.group_code }}</td>
            </tr>
            <tr v-if="!config.competition_groups.length"><td colspan="3">暂无快照</td></tr>
          </tbody>
        </table>
      </div>
      <div class="readonly-table-block readonly-settings">
        <table>
          <caption>默认值</caption>
          <tbody>
            <tr><th scope="row">兜底基础积分</th><td>{{ config.fallback_base_points }}</td></tr>
            <tr><th scope="row">默认参赛人数</th><td>{{ config.default_participant_count }}</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
  <fieldset v-else class="rule-config" :disabled="disabled">
    <legend>规则配置（编辑中）</legend>
    <p>积分、人数系数、组别系数及兜底值范围为 0～10000。完整单项乘算后四舍五入保留 1 位小数，再汇总已舍入分项（精度固定：1，half_up）。团体与混双共用积分和人数系数。</p>
    <section v-for="table in pointTables" :key="table.key" class="config-section">
      <h3>{{ table.label }}排名积分</h3>
      <div class="table-scroll table-wrapper manage-table-wrap"><table class="manage-table rule-points-table"><thead><tr><th>名次</th><th>基础积分</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(points, index) in config[table.key]" :key="index">
          <td>第 {{ index + 1 }} 名</td>
          <td><input class="cell-input" v-model.number="config[table.key][index]" :aria-label="table.label + '第' + (index + 1) + '名积分'" type="number" min="0" max="10000" step="any" required /></td>
          <td class="action-cell"><button type="button" class="btn-row-delete" :aria-label="table.label + '删除第' + (index + 1) + '名'" @click="config[table.key].splice(index, 1)">删除</button></td>
        </tr></tbody></table></div>
      <button type="button" class="btn-add" @click="config[table.key].push(0)">添加{{ table.label }}名次</button>
    </section>
    <section v-for="table in coefficientTables" :key="table.key" class="config-section">
      <h3>{{ table.label }}人数系数</h3>
      <p>区间按人数连续填写；人数上限留空表示无上限，且只能在最后一行。</p>
      <div class="table-scroll table-wrapper manage-table-wrap"><table class="manage-table rule-coefficients-table"><thead><tr><th>最少人数</th><th>最多人数</th><th>系数</th><th>计分名次上限</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(row, index) in config[table.key]" :key="index">
          <td><input class="cell-input" v-model.number="row.min_count" :aria-label="table.label + '区间' + (index + 1) + '最少人数'" type="number" min="2" max="2147483647" step="1" required /></td>
          <td><input class="cell-input" v-model.number="row.max_count" :aria-label="table.label + '区间' + (index + 1) + '最多人数'" type="number" min="2" max="2147483647" step="1" placeholder="无上限" /></td>
          <td><input class="cell-input" v-model.number="row.coefficient" :aria-label="table.label + '区间' + (index + 1) + '系数'" type="number" min="0" max="10000" step="any" required /></td>
          <td><input class="cell-input" v-model.number="row.cutoff" :aria-label="table.label + '区间' + (index + 1) + '名次上限'" type="number" min="1" max="2147483647" step="1" required /></td>
          <td class="action-cell"><button type="button" class="btn-row-delete" :aria-label="table.label + '删除区间' + (index + 1)" @click="config[table.key].splice(index, 1)">删除</button></td>
        </tr></tbody></table></div>
      <button type="button" class="btn-add" @click="addCoefficient(table.key)">添加{{ table.label }}区间</button>
    </section>
    <section class="config-section">
      <h3>组别系数</h3>
      <div class="multiplier-grid"><label v-for="group in groups" :key="group">{{ group }} 组
        <input class="cell-input" v-model.number="config.group_multipliers[group]" :aria-label="group + '组系数'" type="number" min="0" max="10000" step="any" required />
      </label></div>
    </section>
    <section class="config-section">
      <h3>弓种 / 距离组别快照</h3>
      <p>继承原版本快照；下拉选项显示当前字典名称，并保留历史快照及系统支持的代码，不会替换历史配置。</p>
      <div class="table-scroll table-wrapper manage-table-wrap"><table class="manage-table rule-groups-table"><thead><tr><th>弓种</th><th>距离</th><th>组别</th><th>操作</th></tr></thead>
        <tbody><tr v-for="(row, index) in config.competition_groups" :key="index">
          <td><select class="cell-input" v-model="row.bow_type" :aria-label="'快照' + (index + 1) + '弓种'" required>
            <option disabled value="">请选择弓种</option>
            <option v-for="item in bowOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
          </select></td>
          <td><select class="cell-input" v-model="row.distance" :aria-label="'快照' + (index + 1) + '距离'" required>
            <option disabled value="">请选择距离</option>
            <option v-for="item in distanceOptions" :key="item.code" :value="item.code">{{ item.name }}</option>
          </select></td>
          <td><select class="cell-input" v-model="row.group_code" :aria-label="'快照' + (index + 1) + '组别'" required>
            <option disabled value="">请选择组别</option>
            <option v-for="group in groups" :key="group" :value="group">{{ group }}</option>
          </select></td>
          <td class="action-cell"><button type="button" class="btn-row-delete" :aria-label="'删除快照' + (index + 1)" @click="config.competition_groups.splice(index, 1)">删除</button></td>
        </tr></tbody></table></div>
      <button type="button" class="btn-add" @click="config.competition_groups.push({ bow_type: '', distance: '', group_code: '' })">添加组别快照</button>
    </section>
    <section class="config-section multiplier-grid">
      <label>兜底基础积分<input class="cell-input" v-model.number="config.fallback_base_points" aria-label="兜底基础积分" type="number" min="0" max="10000" step="any" required /></label>
      <label>默认参赛人数<input class="cell-input" v-model.number="config.default_participant_count" aria-label="默认参赛人数" type="number" min="2" max="2147483647" step="1" required /></label>
    </section>
  </fieldset>
</template>

<script setup>
import { computed } from 'vue'
import { RULE_BOW_TYPES, RULE_DISTANCES } from '@/utils/scoringRules'

const props = defineProps({
  config: { type: Object, required: true },
  readonly: Boolean,
  disabled: Boolean,
  bowTypes: { type: Array, default: () => [] },
  distances: { type: Array, default: () => [] },
})
const groups = ['S', 'A', 'B', 'C']
const dictionaryNames = items => new Map(items.map(({ code, name }) => [code, name]))
const bowNames = computed(() => dictionaryNames(props.bowTypes))
const distanceNames = computed(() => dictionaryNames(props.distances))
const pointTables = [
  { key: 'ranking_points', label: '排位赛' },
  { key: 'elimination_points', label: '淘汰赛' },
  { key: 'team_points', label: '团体/混双赛' },
]
const coefficientTables = [
  { key: 'individual_coefficients', label: '个人赛' },
  { key: 'team_coefficients', label: '团体/混双赛' },
]
const snapshotOptions = (dictionary, supported, key) => {
  const options = new Map(dictionary.filter(item => item.code).map(item => [item.code, { code: item.code, name: item.name || item.code }]))
  for (const code of [...supported, ...props.config.competition_groups.map(row => row[key])]) {
    if (code && !options.has(code)) options.set(code, { code, name: code })
  }
  return [...options.values()]
}
const bowOptions = computed(() => snapshotOptions(props.bowTypes, RULE_BOW_TYPES, 'bow_type'))
const distanceOptions = computed(() => snapshotOptions(props.distances, RULE_DISTANCES, 'distance'))
const addCoefficient = key => {
  const rows = props.config[key]
  const last = rows[rows.length - 1]
  // Split an open-ended last row at its first count; administrators may adjust
  // both bounds before saving. Never silently replace any inherited coefficients.
  if (last && (last.max_count === null || last.max_count === '')) last.max_count = last.min_count
  rows.push({ min_count: last ? last.max_count + 1 : 2, max_count: null, coefficient: 1, cutoff: 8 })
}
</script>
