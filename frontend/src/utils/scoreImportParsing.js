const normalizeLookupValue = (value) => (value || '').toString().trim().toLowerCase().replace(/\s+/g, '')
const normalizeNameKey = (value) => (value || '').toString().trim().toLowerCase()

export const normalizeKeyPart = (value) => (value || '').toString().trim().toLowerCase()

export const FIELD_MAPPINGS = {
  name: ['姓名', 'name', '名字', '选手', '参赛者'],
  club: ['俱乐部', 'club', '箭馆', '队伍', '俱乐部名称'],
  bow_type: ['弓种', 'bow_type', 'bow', '弓类', '弓的类型'],
  distance: ['距离', 'distance', '比赛距离', '距离(m)', '距离m'],
  format: ['赛制', 'format', '比赛', '赛制格式', '竞赛形式'],
  rank: ['排名', 'rank', '名次', '成绩排名', 'rank号']
}

export const REQUIRED_FIELDS = ['name', 'club', 'bow_type', 'distance', 'format', 'rank']

export const FIELD_LABELS = {
  name: '姓名',
  club: '俱乐部',
  bow_type: '弓种',
  distance: '距离',
  format: '赛制',
  rank: '排名'
}

export const SCORE_IMPORT_ALIASES = {
  bow_type: {
    mode: 'like_dictionary_name',
    buildVariants: (name) => {
      const variants = [name]
      if (name.endsWith('弓')) {
        variants.push(name.slice(0, -1))
      }
      return variants
    }
  },
  distance: {
    mode: 'like_dictionary_name',
    buildVariants: (name) => {
      const variants = [name]
      const digits = (name.match(/\d+/) || [])[0]
      if (digits) {
        variants.push(digits)
        variants.push(`${digits}m`)
      }
      return variants
    }
  },
  format: {
    mode: 'like_dictionary_name',
    buildVariants: (name) => {
      const variants = [name]
      if (name.endsWith('赛')) {
        variants.push(name.slice(0, -1))
      }
      return variants
    }
  },
}

export const mapColumns = (headerRow, fieldMappings = FIELD_MAPPINGS) => {
  const columnMapping = {}
  for (const [fieldName, aliases] of Object.entries(fieldMappings)) {
    for (let colIndex = 0; colIndex < headerRow.length; colIndex++) {
      const headerValue = (headerRow[colIndex] || '').toString().trim().toLowerCase()
      if (aliases.some(alias => headerValue === alias.toLowerCase())) {
        columnMapping[fieldName] = colIndex
        break
      }
    }
  }
  return columnMapping
}

export const buildScoreUniqueKey = (item) => [
  normalizeKeyPart(item?.name),
  normalizeKeyPart(item?.club),
  normalizeKeyPart(item?.bow_type),
  normalizeKeyPart(item?.distance),
  normalizeKeyPart(item?.format)
].join('|')

export const buildClubAutoFillMap = (existingScores) => {
  const clubByNameAndBow = new Map()

  ;(existingScores || []).forEach(item => {
    const mappedClub = (item?.club || '').toString().trim()
    const mappedName = (item?.name || '').toString().trim()
    const mappedBow = (item?.bow_type || '').toString().trim()

    if (!mappedClub || !mappedName || !mappedBow) return

    const key = [normalizeKeyPart(mappedName), normalizeKeyPart(mappedBow)].join('|')
    if (!clubByNameAndBow.has(key)) {
      clubByNameAndBow.set(key, mappedClub)
    }
  })

  return clubByNameAndBow
}

export const markInFileDuplicates = (scores, keyToIndexes) => {
  keyToIndexes.forEach(indexes => {
    if (indexes.length < 2) return
    indexes.forEach((idx, order) => {
      if (!scores[idx]) return
      scores[idx].__duplicate_in_file = true
      if (order > 0) {
        scores[idx].__duplicate_in_file_to_remove = true
        scores[idx].__duplicate = true
      }
    })
  })
}

const buildMissingFieldsMessage = (missingFields, fieldLabels = FIELD_LABELS) => {
  const missingLabels = missingFields.map(field => fieldLabels[field]).join('、')
  return `Excel 文件缺少必需字段：${missingLabels}。列标题应包括：姓名、俱乐部、弓种、距离、赛制、排名`
}

const buildPreparedRows = (jsonData, columnMapping, bowTypeMap, distanceMap, formatMap) => {
  const preparedRows = []

  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i]
    if (!row || !row[columnMapping.name] || (typeof row[columnMapping.name] === 'string' && !row[columnMapping.name].trim())) {
      continue
    }

    const name = (row[columnMapping.name] || '').toString().trim()
    const club = (row[columnMapping.club] || '').toString().trim()
    const bowType = (row[columnMapping.bow_type] || '').toString().trim()
    const distance = (row[columnMapping.distance] || '').toString().trim()
    const format = (row[columnMapping.format] || '').toString().trim()
    const rank = Number.parseInt(row[columnMapping.rank], 10)

    preparedRows.push({
      name,
      club,
      raw_bow_type: bowType,
      raw_distance: distance,
      raw_format: format,
      bow_type: convertToCode(bowType, bowTypeMap),
      distance: convertToCode(distance, distanceMap),
      format: convertToCode(format, formatMap),
      rank
    })
  }

  return preparedRows
}

const buildParseSummaryMessage = (scores) => {
  const validCount = scores.filter(item => item.__valid).length
  const invalidCount = scores.length - validCount
  const duplicateCount = scores.filter(item => item.__valid && item.__duplicate).length
  const inFileDuplicateCount = scores.filter(item => item.__valid && item.__duplicate_in_file).length
  const inFileDuplicateToRemove = scores.filter(item => item.__valid && item.__duplicate_in_file_to_remove).length

  if (invalidCount > 0) {
    return `已解析 ${scores.length} 条：合法 ${validCount} 条，异常 ${invalidCount} 条；与已有成绩重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）`
  }

  return `成功解析 ${scores.length} 条成绩，全部合法；与已有成绩重复 ${duplicateCount} 条（重复导入将覆盖），文件内重复 ${inFileDuplicateCount} 条（其中将移除 ${inFileDuplicateToRemove} 条）。`
}

const buildAliasVariants = (name, aliasConfig) => {
  if (!aliasConfig || typeof aliasConfig !== 'object') {
    return [name]
  }

  if (aliasConfig.mode === 'like_dictionary_name' && typeof aliasConfig.buildVariants === 'function') {
    return aliasConfig.buildVariants(name)
  }

  return [name]
}

export const createValueToCodeMap = (dictArray, aliasConfig = null) => {
  const exactMap = {}
  const likeEntries = []

  if (Array.isArray(dictArray)) {
    dictArray.forEach(item => {
      if (item?.name && item?.code) {
        const normalizedName = normalizeLookupValue(item.name)
        exactMap[normalizedName] = item.code

        const variants = buildAliasVariants(item.name, aliasConfig)
          .map(variant => normalizeLookupValue(variant))
          .filter(Boolean)

        const uniqueVariants = Array.from(new Set(variants))
        uniqueVariants.forEach(variant => {
          if (variant !== normalizedName) {
            likeEntries.push({
              alias: variant,
              name: normalizedName,
              code: item.code
            })
          }
        })
      }
    })
  }

  return {
    exactMap,
    likeEntries
  }
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

export const convertToCode = (value, valueMap) => {
  const trimmedValue = (value || '').toString().trim()
  if (!trimmedValue) return trimmedValue
  const normalizedValue = normalizeLookupValue(trimmedValue)

  if (Object.prototype.hasOwnProperty.call(valueMap.exactMap, normalizedValue)) {
    return valueMap.exactMap[normalizedValue]
  }

  const likeEntry = valueMap.likeEntries.find(entry => entry.alias === normalizedValue)
  return likeEntry ? likeEntry.code : trimmedValue
}

export const build18mRankingBowTypeMap = (scores, validBowTypeCodes = []) => {
  const bowTypeCodeSet = new Set(validBowTypeCodes)
  const bowTypeMap = new Map()

  ;(scores || []).forEach(item => {
    const nameKey = normalizeNameKey(item?.name)
    const distance = (item?.distance || '').toString().trim()
    const format = (item?.format || '').toString().trim()
    const bowType = (item?.bow_type || '').toString().trim()

    if (!nameKey || distance !== '18m' || format !== 'ranking' || !bowType) return
    if (bowTypeCodeSet.size > 0 && !bowTypeCodeSet.has(bowType)) return

    const candidates = bowTypeMap.get(nameKey) || new Set()
    candidates.add(bowType)
    bowTypeMap.set(nameKey, candidates)
  })

  return bowTypeMap
}

export const infer18mBowTypeFromRanking = (score, rankingBowTypeMap) => {
  const bowType = (score?.bow_type || '').toString().trim()
  const distance = (score?.distance || '').toString().trim()
  const nameKey = normalizeNameKey(score?.name)

  if (bowType || distance !== '18m') {
    return { bowType, error: null }
  }

  if (!nameKey) {
    return { bowType: '', error: '弓种为空且未找到对应排位赛成绩' }
  }

  const candidates = rankingBowTypeMap.get(nameKey)
  if (!candidates || candidates.size === 0) {
    return { bowType: '', error: '弓种为空且未找到对应排位赛成绩' }
  }

  if (candidates.size > 1) {
    return { bowType: '', error: '弓种为空且匹配到多条不同弓种的18米排位赛成绩' }
  }

  return { bowType: Array.from(candidates)[0], error: null }
}

export const parseScoreImportData = ({
  jsonData,
  bowTypes = [],
  distances = [],
  competitionFormats = [],
  managedScores = [],
  selectedEventId
}) => {
  if (!jsonData || jsonData.length === 0) {
    return { errorMessage: '文件为空' }
  }

  const headerRow = jsonData[0]
  if (!headerRow) {
    return { errorMessage: '无法读取列标题' }
  }

  const columnMapping = mapColumns(headerRow)
  const missingFields = REQUIRED_FIELDS.filter(field => columnMapping[field] === undefined)
  if (missingFields.length > 0) {
    return { errorMessage: buildMissingFieldsMessage(missingFields) }
  }

  const bowTypeMap = createValueToCodeMap(bowTypes, SCORE_IMPORT_ALIASES.bow_type)
  const distanceMap = createValueToCodeMap(distances, SCORE_IMPORT_ALIASES.distance)
  const formatMap = createValueToCodeMap(competitionFormats, SCORE_IMPORT_ALIASES.format)
  const bowTypeCodes = bowTypes.map(item => item.code)
  const bowCodeSet = new Set(bowTypeCodes)
  const distanceCodeSet = new Set(distances.map(item => item.code))
  const formatCodeSet = new Set(competitionFormats.map(item => item.code))
  const existingScoreKeySet = new Set(managedScores.map(item => buildScoreUniqueKey(item)))
  const preparedRows = buildPreparedRows(jsonData, columnMapping, bowTypeMap, distanceMap, formatMap)
  const rankingBowTypeMap = build18mRankingBowTypeMap(
    [...managedScores, ...preparedRows],
    bowTypeCodes
  )
  const clubByNameAndBow = buildClubAutoFillMap(managedScores)
  const parsedScoreKeyToIndexes = new Map()
  const eventId = Number.parseInt(selectedEventId, 10)
  const scores = []

  preparedRows.forEach(preparedRow => {
    const name = preparedRow.name
    let club = preparedRow.club
    let bow_type = preparedRow.bow_type
    const distance = preparedRow.distance
    const format = preparedRow.format
    const rank = preparedRow.rank
    const rowErrors = []

    if (!bow_type && distance === '18m') {
      const inferred = infer18mBowTypeFromRanking(preparedRow, rankingBowTypeMap)
      if (inferred.error) {
        rowErrors.push(inferred.error)
      } else {
        bow_type = inferred.bowType
      }
    }

    if (name && bow_type) {
      const clubMapKey = [normalizeKeyPart(name), normalizeKeyPart(bow_type)].join('|')
      if (club) {
        clubByNameAndBow.set(clubMapKey, club)
      } else if (clubByNameAndBow.has(clubMapKey)) {
        club = clubByNameAndBow.get(clubMapKey) || ''
      }
    }

    if (!name) rowErrors.push('姓名不能为空')
    if (!bow_type) {
      if (!(distance === '18m' && preparedRow.bow_type === '' && rowErrors.length > 0)) {
        rowErrors.push('弓种无效：-')
      }
    } else if (preparedRow.raw_bow_type && (!hasMappedValue(preparedRow.raw_bow_type, bowTypeMap) || !bowCodeSet.has(bow_type))) {
      rowErrors.push(`弓种无效：${bow_type}`)
    }
    if (!distance || !distanceCodeSet.has(distance) || !hasMappedValue(preparedRow.raw_distance, distanceMap)) {
      rowErrors.push(`距离无效：${distance || '-'}`)
    }
    if (!format || !formatCodeSet.has(format) || !hasMappedValue(preparedRow.raw_format, formatMap)) {
      rowErrors.push(`赛制无效：${format || '-'}`)
    }
    if (!Number.isInteger(rank) || rank < 1) rowErrors.push('排名必须是正整数')

    const scoreUniqueKey = buildScoreUniqueKey({ name, club, bow_type, distance, format })
    const isDuplicate = rowErrors.length === 0 && existingScoreKeySet.has(scoreUniqueKey)

    scores.push({
      event_id: eventId,
      name,
      club: club || '',
      bow_type,
      distance,
      format,
      rank,
      __valid: rowErrors.length === 0,
      __errors: rowErrors,
      __duplicate: isDuplicate,
      __duplicate_in_file: false,
      __duplicate_in_file_to_remove: false,
      __duplicate_with_existing: isDuplicate
    })

    if (rowErrors.length === 0) {
      const currentIndex = scores.length - 1
      const indexes = parsedScoreKeyToIndexes.get(scoreUniqueKey) || []
      indexes.push(currentIndex)
      parsedScoreKeyToIndexes.set(scoreUniqueKey, indexes)
    }
  })

  markInFileDuplicates(scores, parsedScoreKeyToIndexes)

  if (scores.length === 0) {
    return { errorMessage: '文件中没有有效的成绩数据' }
  }

  return {
    scores,
    successMessage: buildParseSummaryMessage(scores),
    errorMessage: null
  }
}

export const recalculateDuplicateFlags = (scores, existingScores = []) => {
  const keyToIndexes = new Map()
  ;(scores || []).forEach((item, idx) => {
    if (!item?.__valid) return
    const key = buildScoreUniqueKey(item)
    const indexes = keyToIndexes.get(key) || []
    indexes.push(idx)
    keyToIndexes.set(key, indexes)
  })

  const existingScoreKeySet = new Set((existingScores || []).map(item => buildScoreUniqueKey(item)))

  return (scores || []).map((item, idx) => {
    if (!item?.__valid) return item

    const key = buildScoreUniqueKey(item)
    const indexes = keyToIndexes.get(key) || []
    const isInFileDup = indexes.length > 1
    const isFirstOccurrence = indexes[0] === idx
    const isExistingDup = existingScoreKeySet.has(key)

    return {
      ...item,
      __duplicate_in_file: isInFileDup,
      __duplicate_in_file_to_remove: isInFileDup && !isFirstOccurrence,
      __duplicate_with_existing: isExistingDup,
      __duplicate: (isInFileDup && !isFirstOccurrence) || isExistingDup
    }
  })
}
