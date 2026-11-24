import { RULE_BOW_TYPES } from './scoringRules'

const BOW_NAMES = new Map([
  ['barebow', ['光弓']], ['longbow', ['美猎弓', '美猎']], ['traditional', ['传统弓', '传统']],
  ['sightless', ['无瞄弓', '无瞄']], ['recurve', ['反曲弓', '反曲']], ['compound', ['复合弓', '复合']],
])
const GENDER_NAMES = new Map([
  ['men', ['男子组', '男子', '男组', '男']],
  ['women', ['女子组', '女子', '女组', '女']],
  ['mixed', ['男女混合组', '男女混合', '混合组', '混合']],
])
const FORMAT_NAMES = new Map([
  ['individual', ['个人赛', '个人']],
  ['team', ['团体赛', '团体']],
  ['mixed_team', ['混合团体赛', '混合团体', '混双赛', '混双', 'mixed_doubles', 'mixed doubles', 'mixed team']],
])
const GENDERS = ['men', 'women', 'mixed']
const DIVISIONS = ['s', 'a', 'b', 'c']
const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim()
const numericDistance = value => {
  const match = normalize(value).match(/^(\d+(?:\.\d+)?)\s*(?:m|米)?$/)
  const number = match ? Number(match[1]) : NaN
  return Number.isFinite(number) && number > 0 ? number : Infinity
}
const genderOf = group => {
  const explicit = normalize(group.genderGroup)
  if (GENDERS.includes(explicit)) return explicit
  const label = normalize(group.label)
  if (/男女混合/.test(label)) return 'mixed'
  if (/女子|女组/.test(label)) return 'women'
  if (/男子|男组/.test(label)) return 'men'
  // The source workbook uses labels such as 光弓组 for mixed/unrestricted groups.
  return 'mixed'
}
const divisionKey = (bow, distance) => bow + ':' + distance
const labelDivision = label => normalize(label).match(/^([sabc])\s*组/)?.[1]

export function indexScorecardDivisions(groups, dictionary = []) {
  const mappings = new Map()
  const put = (index, key, division) => {
    if (!index.has(key)) index.set(key, division)
    else if (index.get(key) !== division) index.set(key, null)
  }
  for (const row of Array.isArray(dictionary) ? dictionary : []) {
    const division = normalize(row?.group_code)
    const bow = normalize(row?.bow_type)
    const distance = numericDistance(row?.distance)
    if (DIVISIONS.includes(division) && bow && Number.isFinite(distance)) put(mappings, divisionKey(bow, distance), division)
  }
  // The current workbook's explicit classification takes precedence over a generic dictionary.
  const imported = new Map()
  for (const group of groups) {
    const division = labelDivision(group?.label)
    const bow = normalize(group?.bowType)
    const distance = numericDistance(group?.distance)
    if (division && bow && Number.isFinite(distance)) put(imported, divisionKey(bow, distance), division)
  }
  for (const [key, division] of imported) if (division) mappings.set(key, division)
  return mappings
}

const describe = (group, divisions) => {
  const format = normalize(group?.format) || 'individual'
  const bow = normalize(group?.bowType)
  const gender = genderOf(group || {})
  const distance = numericDistance(group?.distance)
  const words = [group?.label, bow, ...(BOW_NAMES.get(bow) || []), format, ...(FORMAT_NAMES.get(format) || []),
    gender, ...(GENDER_NAMES.get(gender) || []), group?.distance, Number.isFinite(distance) ? distance + '米' : '']
  const division = labelDivision(group?.label) || divisions?.get(divisionKey(bow, distance))
  return { format, bow, division, gender, distance, text: normalize(words.join(' ')) }
}

/** Individual first; then S/A/B/C, distance (far to near), bow, and gender. */
export function sortScorecardGroups(groups, divisions = indexScorecardDivisions(groups)) {
  const order = (values, value) => { const index = values.indexOf(value); return index < 0 ? values.length : index }
  return groups.map((group, index) => ({ group, index, metadata: describe(group, divisions) }))
    .sort((left, right) => {
      const a = left.metadata, b = right.metadata
      return Number(a.format !== 'individual') - Number(b.format !== 'individual') ||
        order(DIVISIONS, a.division) - order(DIVISIONS, b.division) ||
        (Number.isFinite(b.distance) ? b.distance : 0) - (Number.isFinite(a.distance) ? a.distance : 0) ||
        order(RULE_BOW_TYPES, a.bow) - order(RULE_BOW_TYPES, b.bow) ||
        order(GENDERS, a.gender) - order(GENDERS, b.gender) ||
        order(['individual', 'team', 'mixed_team'], a.format) - order(['individual', 'team', 'mixed_team'], b.format) ||
        left.index - right.index
    }).map(item => item.group)
}

const ALIASES = [
  ...DIVISIONS.map(value => ({ dimension: 'division', value, text: value + '组' })),
  ...[...BOW_NAMES].flatMap(([value, names]) => [value, ...names].map(text => ({ dimension: 'bow', value, text }))),
  ...[...GENDER_NAMES].flatMap(([value, names]) => [value, ...names].map(text => ({ dimension: 'gender', value, text }))),
  ...[...FORMAT_NAMES].flatMap(([value, names]) => [value, ...names].map(text => ({ dimension: 'format', value, text }))),
].sort((left, right) => right.text.length - left.text.length)
const separator = /[\s·•、,，;；:：/|()（）[\]【】_-]/

function searchTerms(query) {
  const terms = []
  let literal = ''
  const flush = () => { if (literal) terms.push({ dimension: 'text', value: literal }); literal = '' }
  for (let index = 0; index < query.length;) {
    const remaining = query.slice(index)
    if (separator.test(query[index])) { flush(); index += 1; continue }
    const distance = remaining.match(/^\d+(?:\.\d+)?/)
    if (distance) {
      flush()
      terms.push({ dimension: 'distance', value: Number(distance[0]) })
      index += distance[0].length
      const rest = query.slice(index)
      if (rest.startsWith('米') || (rest.startsWith('m') && !ALIASES.some(alias => rest.startsWith(alias.text)))) index += 1
      continue
    }
    const alias = ALIASES.find(item => remaining.startsWith(item.text))
    if (alias) {
      flush(); terms.push(alias); index += alias.text.length
    } else {
      literal += query[index]; index += 1
    }
  }
  flush()
  return terms
}

/** AND search over semantic terms and literal labels, without changing the supplied order. */
export function filterScorecardGroups(groups, query, divisions = indexScorecardDivisions(groups)) {
  const normalized = normalize(query)
  if (!normalized) return [...groups]
  const terms = searchTerms(normalized)
  if (!terms.length) return []
  return groups.filter(group => {
    if (!group) return false
    const metadata = describe(group, divisions)
    return terms.every(term => term.dimension === 'text' ? metadata.text.includes(term.value) : metadata[term.dimension] === term.value)
  })
}
