// OOXML solid fill colors use eight-digit ARGB values. Keep both exports in sync.
const BOW_PALETTES = new Map([
  ['traditional', Object.freeze({ header: 'FF99D4B8', stripe: 'FFC2E7D6' })],
  ['barebow', Object.freeze({ header: 'FFFF9D9A', stripe: 'FFFFCBC8' })],
  ['longbow', Object.freeze({ header: 'FF9ABCF7', stripe: 'FFC8DAF8' })],
  ['compound', Object.freeze({ header: 'FFD690F6', stripe: 'FFF2C8F9' })],
  ['recurve', Object.freeze({ header: 'FFFFE175', stripe: 'FFFFEFAE' })],
])
const BOW_CODES = new Map([
  ['传统弓', 'traditional'], ['光弓', 'barebow'], ['美猎弓', 'longbow'], ['复合弓', 'compound'], ['反曲弓', 'recurve'],
])
const DEFAULT_PALETTE = Object.freeze({ header: 'FFD8DFE9', stripe: 'FFEDF1F6' })
const STATION_LABELS = new Map([
  ['春季赛', '第一站'], ['夏季赛', '第二站'], ['秋季赛', '第三站'], ['冬季赛', '第四站'],
])

export const getBowPalette = (bowType, bowTypeLabel) =>
  BOW_PALETTES.get(bowType) ?? BOW_PALETTES.get(BOW_CODES.get(bowTypeLabel)) ?? DEFAULT_PALETTE

export const getStationLabel = label => STATION_LABELS.get(label) || label || '赛季'

export function downloadWorkbook(bytes, filename) {
  const url = URL.createObjectURL(new Blob([bytes], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try {
    link.click()
  } finally {
    link.remove()
    URL.revokeObjectURL(url)
  }
}
