const groupKey = group => JSON.stringify([group.bowType, group.distance, group.genderGroup])
const hasIdentity = group => group && ['bowType', 'distance', 'genderGroup'].every(field => typeof group[field] === 'string' && group[field].length > 0)
const sameRoundPlan = (previous, planned) => Array.isArray(previous) && previous.length === planned.length && planned.every((round, index) => {
  const old = previous[index]
  return old?.key === round.key && old.label === round.label && Array.isArray(old.target_counts) &&
    old.target_counts.length === 2 && old.target_counts.every((value, position) => value === round.target_counts[position])
})

/** Reuse only artifacts for the exact same membership and round plan. URLs are owned by the caller. */
export function reconcileScorecardGroups(previous = [], planned = []) {
  if (!Array.isArray(previous) || !Array.isArray(planned)) throw new Error('记分纸分组数据无效。')
  const oldGroups = new Map(previous.filter(hasIdentity).map(group => [groupKey(group), group]))
  const seen = new Set()
  return planned.map(group => {
    if (!hasIdentity(group) || !Number.isSafeInteger(group.participantCount) || group.participantCount < 0) throw new Error('记分纸分组数据无效。')
    const key = groupKey(group)
    if (seen.has(key)) throw new Error('记分纸分组重复，请重新读取站位表。')
    seen.add(key)
    const suppliedRounds = group.participantCount < 2 ? [] : group.rounds
    if (!Array.isArray(suppliedRounds)) throw new Error('记分纸轮次数据无效。')
    const roundKeys = new Set()
    const rounds = suppliedRounds.map(round => {
      if (!round || typeof round.key !== 'string' || !round.key || roundKeys.has(round.key) || typeof round.label !== 'string' ||
          !Array.isArray(round.target_counts) || round.target_counts.length !== 2 ||
          !round.target_counts.every(count => Number.isSafeInteger(count) && count > 0)) throw new Error('记分纸轮次数据无效。')
      roundKeys.add(round.key)
      return { ...round, target_counts: [...round.target_counts] }
    })
    const old = oldGroups.get(key)
    const unchanged = old && typeof group.fingerprint === 'string' && group.fingerprint.length > 0 && old.fingerprint === group.fingerprint &&
      old.participantCount === group.participantCount && sameRoundPlan(old.rounds, rounds)
    const ranges = Object.fromEntries(rounds.map(round => {
      const value = unchanged ? old.ranges?.[round.key] : null
      return [round.key, Array.isArray(value) && value.length === 2 ? [...value] : ['', '']]
    }))
    return { ...group, key, rounds, ranges, pdf: unchanged ? old.pdf ?? null : null,
      url: unchanged ? old.url ?? '' : '', error: unchanged ? old.error ?? '' : '' }
  })
}

// ZIP32, STORE method: PDFs are already compressed. Explicit UTF-8 filenames and
// general-purpose bit 11 avoid the existing XLSX CFB writer's ASCII-only names.
const ZIP32_LIMIT = 0xffffffff
const UTF8_FLAG = 0x0800
const DOS_DATE = 0x0021 // 1980-01-01; no local timezone or unstable timestamps.
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
  return value >>> 0
})
const crc32 = bytes => {
  let value = 0xffffffff
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8)
  return (value ^ 0xffffffff) >>> 0
}

function safeFilename(value) {
  const leaf = typeof value === 'string' ? value.replace(/\\/g, '/').split('/').pop() : ''
  // Strip control/bidi characters, Windows special characters and traversal names.
  // eslint-disable-next-line no-control-regex
  let name = leaf.replace(/[\u0000-\u001f\u007f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[<>:"|?*]/g, '_')
    .trim().replace(/^\.+/, '').replace(/[. ]+$/, '').normalize('NFC')
  if (!name) name = '记分纸.pdf'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(name)) name = '_' + name
  // TextEncoder replaces lone surrogates; use that same spelling for collision checks.
  return new TextDecoder().decode(new TextEncoder().encode(name))
}

function uniqueFilename(name, used) {
  const dot = name.lastIndexOf('.')
  const stem = dot > 0 ? name.slice(0, dot) : name
  const extension = dot > 0 ? name.slice(dot) : ''
  let result = name
  let suffix = 2
  while (used.has(result.toLowerCase())) result = stem + ' (' + suffix++ + ')' + extension
  used.add(result.toLowerCase())
  return result
}

async function blobBytes(blob) {
  if (typeof blob.arrayBuffer === 'function') return new Uint8Array(await blob.arrayBuffer())
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(new Uint8Array(reader.result))
    reader.onerror = () => reject(new Error('读取记分纸文件失败。'))
    reader.onabort = () => reject(new Error('读取记分纸文件已取消。'))
    reader.readAsArrayBuffer(blob)
  })
}

/** Produce a flat, UTF-8 ZIP Blob. Does not download, allocate URLs or modify inputs. */
export async function buildScorecardZip(entries) {
  if (!Array.isArray(entries)) throw new Error('ZIP 文件清单无效。')
  if (entries.length >= 0xffff) throw new Error('ZIP 文件数量过多，当前不支持 ZIP64。')
  const files = Array.from(entries, entry => ({ name: entry?.name, blob: entry?.blob }))
  const localParts = []
  const centralParts = []
  const used = new Set()
  const encoder = new TextEncoder()
  let offset = 0
  let centralSize = 0
  for (const entry of files) {
    const blob = entry?.blob
    if (!(blob instanceof Blob)) throw new Error('ZIP 清单包含无效文件。')
    if (blob.size >= ZIP32_LIMIT) throw new Error('ZIP 文件过大，当前不支持 ZIP64。')
    const name = encoder.encode(uniqueFilename(safeFilename(entry.name), used))
    if (name.length > 0xffff) throw new Error('ZIP 文件名过长。')
    const localSize = 30 + name.length + blob.size
    const directorySize = 46 + name.length
    if (offset + localSize + centralSize + directorySize + 22 >= ZIP32_LIMIT) throw new Error('ZIP 文件过大，当前不支持 ZIP64。')
    const bytes = await blobBytes(blob)
    if (bytes.byteLength !== blob.size) throw new Error('记分纸文件读取不完整。')
    const checksum = crc32(bytes)
    const local = new Uint8Array(30)
    const localView = new DataView(local.buffer)
    localView.setUint32(0, 0x04034b50, true)
    localView.setUint16(4, 20, true)
    localView.setUint16(6, UTF8_FLAG, true)
    localView.setUint16(12, DOS_DATE, true)
    localView.setUint32(14, checksum, true)
    localView.setUint32(18, bytes.length, true)
    localView.setUint32(22, bytes.length, true)
    localView.setUint16(26, name.length, true)
    localParts.push(local, name, bytes)

    const central = new Uint8Array(46)
    const centralView = new DataView(central.buffer)
    centralView.setUint32(0, 0x02014b50, true)
    centralView.setUint16(4, 20, true)
    centralView.setUint16(6, 20, true)
    centralView.setUint16(8, UTF8_FLAG, true)
    centralView.setUint16(14, DOS_DATE, true)
    centralView.setUint32(16, checksum, true)
    centralView.setUint32(20, bytes.length, true)
    centralView.setUint32(24, bytes.length, true)
    centralView.setUint16(28, name.length, true)
    centralView.setUint32(42, offset, true)
    centralParts.push(central, name)
    offset += localSize
    centralSize += directorySize
  }
  const end = new Uint8Array(22)
  const endView = new DataView(end.buffer)
  endView.setUint32(0, 0x06054b50, true)
  endView.setUint16(8, files.length, true)
  endView.setUint16(10, files.length, true)
  endView.setUint32(12, centralSize, true)
  endView.setUint32(16, offset, true)
  return new Blob([...localParts, ...centralParts, end], { type: 'application/zip' })
}
