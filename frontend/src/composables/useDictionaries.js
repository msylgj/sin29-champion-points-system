import { ref } from 'vue'

import { dictionaryAPI } from '@/api'

export function useDictionaries() {
  const bowTypes = ref([])
  const distances = ref([])
  const competitionFormats = ref([])
  const competitionGenderGroups = ref([])
  const competitionGroups = ref([])

  const loadDictionaries = async () => {
    const response = await dictionaryAPI.getAll()
    const data = response?.data || {}

    bowTypes.value = data.bowTypes || []
    distances.value = data.distances || []
    competitionFormats.value = data.competitionFormats || []
    competitionGenderGroups.value = data.competitionGenderGroups || []
    competitionGroups.value = data.competitionGroups || []

    return data
  }

  return {
    bowTypes,
    distances,
    competitionFormats,
    competitionGenderGroups,
    competitionGroups,
    loadDictionaries
  }
}
