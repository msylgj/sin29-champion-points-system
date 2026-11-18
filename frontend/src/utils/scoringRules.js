export const SEASONS = ['春季赛', '夏季赛', '秋季赛', '冬季赛']
export const RULE_BOW_TYPES = ['barebow', 'longbow', 'traditional', 'sightless', 'recurve', 'compound']
export const RULE_DISTANCES = ['10m', '18m', '30m', '50m', '70m']

export const cloneRuleConfig = config => JSON.parse(JSON.stringify(config))
export const seasonIndex = event => Number(event.year) * 4 + SEASONS.indexOf(event.season)
export const seasonLabel = event => event ? event.year + '年 ' + event.season : ''
export const nextSeason = event => {
  if (!event || !SEASONS.includes(event.season)) return null
  const index = SEASONS.indexOf(event.season) + 1
  return { year: Number(event.year) + (index === 4 ? 1 : 0), season: SEASONS[index % 4] }
}

export async function loadAllRuleEvents(eventAPI) {
  const events = new Map()
  let page = 1
  while (true) {
    const response = await eventAPI.getList({ page, page_size: 100 })
    const items = response.items || []
    if (!items.length) {
      if (events.size < Number(response.total || 0)) throw new Error('赛事列表不完整，请重试')
      break
    }
    const previousSize = events.size
    items.forEach(event => events.set(event.id, event))
    if (events.size === previousSize) throw new Error('赛事分页重复，请重新加载')
    const total = Number(response.total)
    if (Number.isFinite(total) ? events.size >= total : items.length < 100) break
    page += 1
  }
  return [...events.values()]
    .sort((a, b) => seasonIndex(a) - seasonIndex(b))
}

export const normalizeRuleConfig = config => {
  const result = cloneRuleConfig(config)
  for (const key of ['individual_coefficients', 'team_coefficients']) {
    result[key].forEach(row => { if (row.max_count === '') row.max_count = null })
  }
  result.precision = 1
  result.rounding = 'half_up'
  return result
}

const nonnegative = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000
const integer = value => Number.isInteger(value) && value >= 0 && value <= 2147483647

export function validateRuleConfig(config) {
  if (!config) return '规则配置不能为空'
  for (const [key, label] of [['ranking_points', '排位赛'], ['elimination_points', '淘汰赛'], ['team_points', '团体/混双赛']]) {
    if (!config[key]?.length || config[key].some(value => !nonnegative(value))) return label + '排名积分必须为0～10000的非负数字，且至少保留一行'
  }
  for (const [key, label] of [['individual_coefficients', '个人赛'], ['team_coefficients', '团体/混双赛']]) {
    const rows = config[key]
    if (!rows?.length) return label + '人数系数至少保留一行'
    if (rows[0].min_count !== 2) return label + '系数区间必须从2人开始'
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]
      const max = row.max_count === '' ? null : row.max_count
      if (!integer(row.min_count) || row.min_count < 2 || (max !== null && (!integer(max) || max < row.min_count)) || !nonnegative(row.coefficient) || !integer(row.cutoff) || row.cutoff < 1) return label + '系数区间、系数和名次上限无效'
      if (index && row.min_count !== rows[index - 1].max_count + 1) return label + '系数区间必须按人数连续且不重叠'
      if (max === null && index !== rows.length - 1) return label + '无上限区间必须放在最后'
    }
    if (rows[rows.length - 1].max_count !== null && rows[rows.length - 1].max_count !== '') return label + '最后一个人数区间应设为无上限'
  }
  if (['S', 'A', 'B', 'C'].some(group => !nonnegative(config.group_multipliers?.[group]))) return '组别系数必须为0～10000的非负数字'
  if (!nonnegative(config.fallback_base_points) || !integer(config.default_participant_count) || config.default_participant_count < 2) return '兜底积分必须非负，默认参赛人数必须为不小于2的整数'
  const maxBase = Math.max(config.fallback_base_points, ...config.ranking_points, ...config.elimination_points, ...config.team_points)
  const maxCoefficient = Math.max(1, ...config.individual_coefficients.map(row => row.coefficient), ...config.team_coefficients.map(row => row.coefficient))
  if (maxBase * maxCoefficient * Math.max(...Object.values(config.group_multipliers)) > 1e12) return '最大单项乘算结果不能超过1e12'
  const seen = new Set()
  for (const group of config.competition_groups || []) {
    if (!RULE_BOW_TYPES.includes(group.bow_type) || !RULE_DISTANCES.includes(group.distance) || !['S', 'A', 'B', 'C'].includes(group.group_code)) return '弓种、距离及组别快照必须使用支持的代码'
    const key = group.bow_type.trim() + ':' + group.distance.trim()
    if (seen.has(key)) return '弓种和距离的组别快照不能重复'
    seen.add(key)
  }
  return ''
}

export const ruleErrorMessage = error => {
  const detail = error?.detail || error?.response?.data?.detail
  if (typeof detail === 'string') return detail
  if (Array.isArray(detail)) return detail.map(item => (item.loc || []).join('.') + '：' + item.msg).join('；')
  return error?.message || '请求失败，请稍后重试'
}
