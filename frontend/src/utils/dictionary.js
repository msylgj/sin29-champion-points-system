/**
 * 字典相关的工具函数
 */

/**
 * 根据 code 获取弓种名称
 * @param {string} code - 弓种代码
 * @param {Array} bowTypes - 弓种列表（从API获取）
 * @returns {string} 弓种名称
 */
export const getBowTypeName = (code, bowTypes = []) => {
  const found = bowTypes.find(item => item.code === code)
  if (found) return found.name
  
  // 备用硬编码标签（为了兼容没有字典数据的情况）
  const fallbackLabels = {
    'recurve': '反曲弓',
    'compound': '复合弓',
    'barebow': '光弓',
    'traditional': '传统弓',
    'longbow': '美猎弓'
  }
  return fallbackLabels[code] || code
}

/**
 * 根据 code 获取距离名称
 * @param {string} code - 距离代码
 * @param {Array} distances - 距离列表（从API获取）
 * @returns {string} 距离名称
 */
export const getDistanceName = (code, distances = []) => {
  const found = distances.find(item => item.code === code)
  if (found) return found.name
  
  // 备用硬编码标签
  const fallbackLabels = {
    '18m': '18米',
    '30m': '30米',
    '50m': '50米',
    '70m': '70米'
  }
  return fallbackLabels[code] || code
}

/**
 * 根据 code 获取赛制名称
 * @param {string} code - 赛制代码
 * @param {Array} formats - 赛制列表（从API获取）
 * @returns {string} 赛制名称
 */
export const getFormatName = (code, formats = []) => {
  const found = formats.find(item => item.code === code)
  if (found) return found.name
  
  // 备用硬编码标签
  const fallbackLabels = {
    'ranking': '排位赛',
    'elimination': '淘汰赛',
    'mixed_doubles': '混双赛',
    'team': '团体赛'
  }
  return fallbackLabels[code] || code
}

/**
 * 获取所有字典数据的映射对象（便于在模板中使用）
 * @param {Object} dictionaries - 从API获取的字典对象
 * @returns {Object} 映射对象
 */
export const createDictionaryMaps = (dictionaries = {}) => {
  const bowTypesArray = dictionaries.bowTypes || []
  const distancesArray = dictionaries.distances || []
  const formatsArray = dictionaries.competitionFormats || []
  
  return {
    bowTypeMap: Object.fromEntries(bowTypesArray.map(item => [item.code, item.name])),
    distanceMap: Object.fromEntries(distancesArray.map(item => [item.code, item.name])),
    formatMap: Object.fromEntries(formatsArray.map(item => [item.code, item.name]))
  }
}
