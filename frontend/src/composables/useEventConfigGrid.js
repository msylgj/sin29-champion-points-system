import { computed } from 'vue'

const countRows = [
  { key: 'individual_participant_count', label: '个人（排位/淘汰）' },
  { key: 'mixed_doubles_team_count', label: '混双（队伍）' },
  { key: 'team_count', label: '团体（队伍）' }
]

const parseDistanceOrder = (value) => parseInt(value, 10) || 0

export function useEventConfigGrid(distances, competitionGroups) {
  const sortedDistances = computed(() => {
    return [...distances.value].sort((a, b) => parseDistanceOrder(b.code) - parseDistanceOrder(a.code))
  })

  const getGroupCode = (bowType, distance) => {
    const found = competitionGroups.value.find(
      item => item.bow_type === bowType && item.distance === distance
    )
    return found ? `${found.group_code}组` : '-'
  }

  const shouldShowDistance = (distance) => {
    return competitionGroups.value.some(item => item.distance === distance)
  }

  const isInputDisabled = (bowType, distance) => {
    return !competitionGroups.value.some(
      item => item.bow_type === bowType && item.distance === distance
    )
  }

  return {
    countRows,
    sortedDistances,
    getGroupCode,
    shouldShowDistance,
    isInputDisabled
  }
}
