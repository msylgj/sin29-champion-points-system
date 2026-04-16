import { computed } from 'vue'

const countRows = [
  { key: 'individual_participant_count', label: '个人' },
  { key: 'team_count', label: '团体' },
  { key: 'mixed_doubles_team_count', label: '混双' }
]

const parseDistanceOrder = (value) => parseInt(value, 10) || 0

export function useEventConfigGrid(distances, competitionGroups) {
  const sortedDistances = computed(() => {
    return [...distances.value].sort((a, b) => parseDistanceOrder(b.code) - parseDistanceOrder(a.code))
  })

  const bowTypeDistanceMap = computed(() => {
    const map = new Map()

    competitionGroups.value.forEach(item => {
      if (!item?.bow_type || !item?.distance) return
      if (!map.has(item.bow_type)) {
        map.set(item.bow_type, new Set())
      }
      map.get(item.bow_type)?.add(item.distance)
    })

    return map
  })

  const getGroupCode = (bowType, distance) => {
    const found = competitionGroups.value.find(
      item => item.bow_type === bowType && item.distance === distance
    )
    return found ? `${found.group_code}组` : '-'
  }

  const getBowTypeDistances = (bowType) => {
    const allowedDistances = bowTypeDistanceMap.value.get(bowType) || new Set()
    return sortedDistances.value.filter(distance => allowedDistances.has(distance.code))
  }

  const hasBowTypeDistances = (bowType) => {
    return getBowTypeDistances(bowType).length > 0
  }

  return {
    countRows,
    sortedDistances,
    getBowTypeDistances,
    hasBowTypeDistances,
    getGroupCode,
  }
}
