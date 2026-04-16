import {
  SCORE_IMPORT_ALIASES,
  convertToCode,
  createValueToCodeMap,
  mapColumns,
  markInFileDuplicates,
  normalizeKeyPart,
} from './scoreImportParsing'

const normalizeLookupValue = (value) => (value || '').toString().trim().toLowerCase().replace(/\s+/g, '')

export const REGISTRATION_FIELD_MAPPINGS = {
  name: ['姓名', 'name', '名字', '选手', '参赛者'],
  club: ['俱乐部', 'club', '箭馆', '队伍', '俱乐部名称'],
  distance: ['距离', 'distance', '比赛距离', '距离(m)', '距离m'],
  competition_bow_type: ['比赛弓种', 'competition_bow_type', 'competition_bow', '弓种', '比赛弓类'],
  points_bow_type: ['积分弓种', 'points_bow_type', 'points_bow', '积分弓类', '积分项目弓种'],
  competition_gender_group: ['分组', 'competition_gender_group', 'gender_group', 'group', '比赛性别分组'],
}

export const REGISTRATION_REQUIRED_FIELDS = [
  'name',
  'club',
  'distance',
  'competition_bow_type',
  'points_bow_type',
  'competition_gender_group',
]

const REGISTRATION_FIELD_LABELS = {
  name: '姓名',
  club: '俱乐部',
  distance: '距离',
  competition_bow_type: '比赛弓种',
  points_bow_type: '积分弓种',
  competition_gender_group: '分组',
}

const REGISTRATION_IMPORT_ALIASES = {
  distance: SCORE_IMPORT_ALIASES.distance,
  competition_bow_type: SCORE_IMPORT_ALIASES.bow_type,
  points_bow_type: SCORE_IMPORT_ALIASES.bow_type,
  competition_gender_group: {
    mode: 'like_dictionary_name',
    buildVariants: (name) => {
      const variants = [name]
      if (name.endsWith('组')) {
        variants.push(name.slice(0, -1))
      }
      return variants
    },
  },
}

const buildMissingFieldsMessage = (missingFields) => {
  const missingLabels = missingFields.map(field => REGISTRATION_FIELD_LABELS[field]).join('、')
  return `Excel 文件缺少必需字段：${missingLabels}。列标题应包括：姓名、俱乐部、距离、比赛弓种、积分弓种、分组`
}

const hasMappedValue = (value, valueMap) => {
  const trimmedValue = (value || '').toString().trim()
  if (!trimmedValue) return false
  const normalizedValue = normalizeLookupValue(trimmedValue)
  if (Object.prototype.hasOwnProperty.call(valueMap.exactMap, normalizedValue)) {
    return true
  }
  return valueMap.likeEntries.some(entry => entry.alias === normalizedValue)
}

export const buildRegistrationUniqueKey = (item) => [
  normalizeKeyPart(item?.year),
  normalizeKeyPart(item?.season),
  normalizeKeyPart(item?.name),
  normalizeKeyPart(item?.distance),
  normalizeKeyPart(item?.competition_bow_type),
].join('|')

const buildPreparedRows = (jsonData, columnMapping, competitionBowTypeMap, pointsBowTypeMap, distanceMap, genderGroupMap) => {
  const preparedRows = []

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || !row[columnMapping.name] || (typeof row[columnMapping.name] === 'string' && !row[columnMapping.name].trim())) {
      continue
    }

    const name = (row[columnMapping.name] || '').toString().trim()
    const club = (row[columnMapping.club] || '').toString().trim()
    const distance = (row[columnMapping.distance] || '').toString().trim()
    const competitionBowType = (row[columnMapping.competition_bow_type] || '').toString().trim()
    const pointsBowType = (row[columnMapping.points_bow_type] || '').toString().trim()
    const genderGroup = (row[columnMapping.competition_gender_group] || '').toString().trim()

    preparedRows.push({
      name,
      club,
      raw_distance: distance,
      raw_competition_bow_type: competitionBowType,
      raw_points_bow_type: pointsBowType,
      raw_competition_gender_group: genderGroup,
      distance: convertToCode(distance, distanceMap),
      competition_bow_type: convertToCode(competitionBowType, competitionBowTypeMap),
      points_bow_type: convertToCode(pointsBowType, pointsBowTypeMap),
      competition_gender_group: convertToCode(genderGroup, genderGroupMap),
    })
  }

  return preparedRows
}

const buildParseSummaryMessage = (registrations) => {
  const validCount = registrations.filter(item => item.__valid).length
  const invalidCount = registrations.length - validCount
  const duplicateCount = registrations.filter(item => item.__valid && item.__duplicate).length
  const inFileDuplicateCount = registrations.filter(item => item.__valid && item.__duplicate_in_file).length
  const inFileDuplicateToRemove = registrations.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length

  if (invalidCount > 0) {
    return `已解析 ${registrations.length} 条：合法 ${validCount} 条，异常 ${invalidCount} 条；与已有报名重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）`
  }

  return `成功解析 ${registrations.length} 条报名，全部合法；与已有报名重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）。`
}

export const parseRegistrationImportData = ({
  jsonData,
  bowTypes = [],
  distances = [],
  competitionGenderGroups = [],
  existingRegistrations = [],
  selectedYear,
  selectedSeason,
}) => {
  if (!selectedYear || !selectedSeason) {
    return { errorMessage: '请先选择赛年和赛季' }
  }

  if (!jsonData || jsonData.length === 0) {
    return { errorMessage: '文件为空' }
  }

  const headerRow = jsonData[0]
  if (!headerRow) {
    return { errorMessage: '无法读取列标题' }
  }

  const columnMapping = mapColumns(headerRow, REGISTRATION_FIELD_MAPPINGS)
  const missingFields = REGISTRATION_REQUIRED_FIELDS.filter(field => columnMapping[field] === undefined)
  if (missingFields.length > 0) {
    return { errorMessage: buildMissingFieldsMessage(missingFields) }
  }

  const competitionBowTypeMap = createValueToCodeMap(bowTypes, REGISTRATION_IMPORT_ALIASES.competition_bow_type)
  const pointsBowTypeCandidates = bowTypes.filter(item => ['barebow', 'longbow', 'traditional'].includes(item.code))
  const pointsBowTypeMap = createValueToCodeMap(pointsBowTypeCandidates, REGISTRATION_IMPORT_ALIASES.points_bow_type)
  const distanceMap = createValueToCodeMap(distances, REGISTRATION_IMPORT_ALIASES.distance)
  const genderGroupMap = createValueToCodeMap(competitionGenderGroups, REGISTRATION_IMPORT_ALIASES.competition_gender_group)

  const competitionBowTypeCodeSet = new Set(bowTypes.map(item => item.code))
  const distanceCodeSet = new Set(distances.map(item => item.code))
  const genderGroupCodeSet = new Set(competitionGenderGroups.map(item => item.code))
  const allowedSightlessPointsBowTypes = new Set(['barebow', 'longbow', 'traditional'])
  const existingRegistrationKeySet = new Set((existingRegistrations || []).map(item => buildRegistrationUniqueKey(item)))
  const preparedRows = buildPreparedRows(
    jsonData,
    columnMapping,
    competitionBowTypeMap,
    pointsBowTypeMap,
    distanceMap,
    genderGroupMap
  )

  const registrations = []
  const parsedRegistrationKeyToIndexes = new Map()

  preparedRows.forEach(preparedRow => {
    const rowErrors = []
    const name = preparedRow.name
    const club = preparedRow.club
    const distance = preparedRow.distance
    const competition_bow_type = preparedRow.competition_bow_type
    const competition_gender_group = preparedRow.competition_gender_group
    let points_bow_type = ''

    if (!name) rowErrors.push('姓名不能为空')
    if (!club) rowErrors.push('俱乐部不能为空')

    if (!distance || !distanceCodeSet.has(distance) || !hasMappedValue(preparedRow.raw_distance, distanceMap)) {
      rowErrors.push(`距离无效：${distance || '-'}`)
    }

    if (
      !competition_bow_type
      || !competitionBowTypeCodeSet.has(competition_bow_type)
      || !hasMappedValue(preparedRow.raw_competition_bow_type, competitionBowTypeMap)
    ) {
      rowErrors.push(`比赛弓种无效：${competition_bow_type || '-'}`)
    }

    if (
      !competition_gender_group
      || !genderGroupCodeSet.has(competition_gender_group)
      || !hasMappedValue(preparedRow.raw_competition_gender_group, genderGroupMap)
    ) {
      rowErrors.push(`分组无效：${competition_gender_group || '-'}`)
    }

    if (competition_bow_type === 'sightless') {
      if (
        !preparedRow.points_bow_type
        || !allowedSightlessPointsBowTypes.has(preparedRow.points_bow_type)
        || !hasMappedValue(preparedRow.raw_points_bow_type, pointsBowTypeMap)
      ) {
        rowErrors.push('无瞄弓的积分弓种仅支持：光弓、美猎弓、传统弓')
      } else {
        points_bow_type = preparedRow.points_bow_type
      }
    } else if (competition_bow_type && competitionBowTypeCodeSet.has(competition_bow_type)) {
      points_bow_type = competition_bow_type
    }

    const item = {
      year: Number(selectedYear),
      season: selectedSeason,
      name,
      club,
      distance,
      competition_bow_type,
      points_bow_type,
      competition_gender_group,
    }

    const registrationUniqueKey = buildRegistrationUniqueKey(item)
    const isDuplicate = rowErrors.length === 0 && existingRegistrationKeySet.has(registrationUniqueKey)

    registrations.push({
      ...item,
      __valid: rowErrors.length === 0,
      __errors: rowErrors,
      __duplicate: isDuplicate,
      __duplicate_in_file: false,
      __duplicate_in_file_to_remove: false,
      __duplicate_with_existing: isDuplicate,
    })

    if (rowErrors.length === 0) {
      const currentIndex = registrations.length - 1
      const indexes = parsedRegistrationKeyToIndexes.get(registrationUniqueKey) || []
      indexes.push(currentIndex)
      parsedRegistrationKeyToIndexes.set(registrationUniqueKey, indexes)
    }
  })

  markInFileDuplicates(registrations, parsedRegistrationKeyToIndexes)

  if (registrations.length === 0) {
    return { errorMessage: '文件中没有有效的报名数据' }
  }

  return {
    registrations,
    successMessage: buildParseSummaryMessage(registrations),
    errorMessage: null,
  }
}

export const recalculateRegistrationDuplicateFlags = (registrations, existingRegistrations = []) => {
  const keyToIndexes = new Map()
  ;(registrations || []).forEach((item, idx) => {
    if (!item?.__valid) return
    const key = buildRegistrationUniqueKey(item)
    const indexes = keyToIndexes.get(key) || []
    indexes.push(idx)
    keyToIndexes.set(key, indexes)
  })

  const existingRegistrationKeySet = new Set((existingRegistrations || []).map(item => buildRegistrationUniqueKey(item)))

  return (registrations || []).map((item, idx) => {
    if (!item?.__valid) return item

    const key = buildRegistrationUniqueKey(item)
    const indexes = keyToIndexes.get(key) || []
    const isInFileDup = indexes.length > 1
    const isFirstOccurrence = indexes[0] === idx
    const isExistingDup = existingRegistrationKeySet.has(key)

    return {
      ...item,
      __duplicate_in_file: isInFileDup,
      __duplicate_in_file_to_remove: isInFileDup && !isFirstOccurrence,
      __duplicate_with_existing: isExistingDup,
      __duplicate: (isInFileDup && !isFirstOccurrence) || isExistingDup,
    }
  })
}
