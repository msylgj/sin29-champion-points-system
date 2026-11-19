const DEFAULT_FORMATS = ['ranking', 'elimination', 'mixed_doubles', 'team']
const GENDER_GROUPS = ['men', 'women', 'mixed']
const SIGHTLESS_BOW = 'sightless'
const SEPARATE_BOWS = ['barebow', 'longbow', 'traditional']

const code = value => value == null ? '' : String(value)
const keyOf = values => JSON.stringify(values)
const uniqueCodes = rows => [...new Set(rows.map(row => code(row.code)).filter(Boolean))]

/** Coverage is a count of saved rows, not an inference about who ought to compete. */
export function buildCoverageRows(kind, records, dictionaries) {
  if (!['registrations', 'scores'].includes(kind)) throw new Error('不支持的核查类型')
  const pairs = new Map()
  const addPair = (bowType, distance) => {
    const pair = { bowType: code(bowType), distance: code(distance) }
    const key = keyOf([pair.bowType, pair.distance])
    pairs.set(key, pair)
  }
  for (const group of dictionaries.competitionGroups || []) addPair(group.bow_type, group.distance)
  for (const record of records) addPair(kind === 'registrations' ? record.competition_bow_type : record.bow_type, record.distance)

  const rows = new Map()
  const addRow = (pair, format = '', genderGroup = '') => {
    const key = keyOf([pair.bowType, pair.distance, format, genderGroup])
    if (!rows.has(key)) rows.set(key, { ...pair, key, format, genderGroup, count: 0, covered: false })
    return rows.get(key)
  }
  const dictionaryFormats = uniqueCodes(dictionaries.competitionFormats || [])
  const formats = dictionaryFormats.length ? dictionaryFormats : DEFAULT_FORMATS
  for (const pair of pairs.values()) {
    if (kind === 'registrations') addRow(pair)
    else for (const format of formats) {
      for (const genderGroup of format === 'mixed_doubles' ? ['mixed'] : GENDER_GROUPS) addRow(pair, format, genderGroup)
    }
  }
  for (const record of records) {
    const bowType = code(kind === 'registrations' ? record.competition_bow_type : record.bow_type)
    const pair = pairs.get(keyOf([bowType, code(record.distance)]))
    const format = kind === 'scores' ? code(record.format) : ''
    const genderGroup = kind === 'scores' ? code(record.gender_group) : ''
    const key = keyOf([pair.bowType, pair.distance, format, genderGroup])
    const row = rows.get(key) || addRow(pair, format, genderGroup)
    row.count += 1
    row.covered = true
  }
  const savedBows = new Map()
  const distanceFormatKey = row => keyOf([row.distance, row.format])
  if (kind === 'scores') {
    for (const row of rows.values()) {
      if (!row.covered) continue
      const key = distanceFormatKey(row)
      if (!savedBows.has(key)) savedBows.set(key, new Set())
      savedBows.get(key).add(row.bowType)
    }
  }
  const showRow = row => {
    if (kind !== 'scores') return true
    const hasRecords = gender => rows.get(keyOf([row.bowType, row.distance, row.format, gender]))?.covered
    if ((row.genderGroup === 'men' || row.genderGroup === 'women') && hasRecords('mixed')) return false
    if (row.genderGroup === 'mixed' && !row.covered && (hasRecords('men') || hasRecords('women'))) return false

    // Bow substitution depends on saved scores in any group and only hides empty rows.
    if (row.covered) return true
    const bows = savedBows.get(distanceFormatKey(row))
    if (row.bowType === SIGHTLESS_BOW) return !SEPARATE_BOWS.some(bow => bows?.has(bow))
    if (SEPARATE_BOWS.includes(row.bowType)) return !bows?.has(SIGHTLESS_BOW)
    return true
  }
  const bowOrder = uniqueCodes(dictionaries.bowTypes || [])
  const order = (list, value) => { const index = list.indexOf(value); return index < 0 ? list.length : index }
  const compareText = (left, right) => left.localeCompare(right, 'zh-CN')
  return [...rows.values()].filter(showRow).sort((left, right) =>
    order(bowOrder, left.bowType) - order(bowOrder, right.bowType) || compareText(left.bowType, right.bowType) ||
    (Number.parseFloat(right.distance) || 0) - (Number.parseFloat(left.distance) || 0) || compareText(left.distance, right.distance) ||
    order(formats, left.format) - order(formats, right.format) || compareText(left.format, right.format) ||
    order(GENDER_GROUPS, left.genderGroup) - order(GENDER_GROUPS, right.genderGroup) || compareText(left.genderGroup, right.genderGroup))
}
