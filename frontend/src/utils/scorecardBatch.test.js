import { afterEach, describe, expect, it, vi } from 'vitest'
import { CFB } from 'xlsx/xlsx.mjs'
import { buildScorecardZip, reconcileScorecardGroups } from './scorecardBatch'

const group = (overrides = {}) => ({ bowType: 'barebow', distance: '30m', genderGroup: 'men', label: '光弓 30米 男子组',
  participantCount: 4, fingerprint: 'members-a', rounds: [{ key: '1/2', label: '半决赛', target_counts: [2, 4] }, { key: 'gold', label: '金牌赛', target_counts: [1, 2] }], ...overrides })
const filledGroup = (overrides = {}) => {
  const result = reconcileScorecardGroups([], [group(overrides)])[0]
  result.ranges = { '1/2': [1, 2], gold: [7, 7] }
  result.pdf = new Blob(['%PDF-test'], { type: 'application/pdf' })
  result.url = 'blob:existing-pdf'
  result.error = '旧失败提示'
  return result
}

const readBlob = blob => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(new Uint8Array(reader.result))
  reader.onerror = reject
  reader.readAsArrayBuffer(blob)
})
const referenceCrc32 = bytes => {
  let crc = -1
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  }
  return (crc ^ -1) >>> 0
}

// Read the actual central/local ZIP records independently; UTF-8 must be marked
// in both headers. CFB 0.18's reader exposes raw filename bytes, not UTF-8 text.
async function readZip(blob) {
  const bytes = await readBlob(blob)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const end = bytes.length - 22
  expect(view.getUint32(end, true)).toBe(0x06054b50)
  expect(view.getUint16(end + 4, true)).toBe(0)
  expect(view.getUint16(end + 6, true)).toBe(0)
  const count = view.getUint16(end + 10, true)
  expect(view.getUint16(end + 8, true)).toBe(count)
  expect(view.getUint16(end + 20, true)).toBe(0)
  const centralOffset = view.getUint32(end + 16, true)
  const centralSize = view.getUint32(end + 12, true)
  expect(centralOffset + centralSize).toBe(end)
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const files = []
  let cursor = centralOffset
  for (let index = 0; index < count; index += 1) {
    expect(view.getUint32(cursor, true)).toBe(0x02014b50)
    expect(view.getUint16(cursor + 8, true)).toBe(0x0800)
    expect(view.getUint16(cursor + 10, true)).toBe(0)
    expect(view.getUint32(cursor + 38, true)).toBe(0) // no symlinks or special files
    const size = view.getUint32(cursor + 24, true)
    const crc = view.getUint32(cursor + 16, true)
    const nameLength = view.getUint16(cursor + 28, true)
    const extraLength = view.getUint16(cursor + 30, true)
    const commentLength = view.getUint16(cursor + 32, true)
    const nameBytes = bytes.slice(cursor + 46, cursor + 46 + nameLength)
    const name = decoder.decode(nameBytes)
    const localOffset = view.getUint32(cursor + 42, true)
    expect(view.getUint32(localOffset, true)).toBe(0x04034b50)
    expect(view.getUint16(localOffset + 6, true)).toBe(0x0800)
    expect(view.getUint16(localOffset + 8, true)).toBe(0)
    expect(view.getUint32(localOffset + 14, true)).toBe(crc)
    expect(view.getUint32(localOffset + 18, true)).toBe(size)
    expect(view.getUint32(localOffset + 22, true)).toBe(size)
    expect(view.getUint32(cursor + 20, true)).toBe(size)
    expect(view.getUint16(localOffset + 26, true)).toBe(nameLength)
    expect(view.getUint16(localOffset + 28, true)).toBe(0)
    expect(bytes.slice(localOffset + 30, localOffset + 30 + nameLength)).toEqual(nameBytes)
    const payload = bytes.slice(localOffset + 30 + nameLength, localOffset + 30 + nameLength + size)
    expect(payload.length).toBe(size)
    expect(referenceCrc32(payload)).toBe(crc)
    files.push({ name, bytes: payload, crc, nameLength, localOffset })
    cursor += 46 + nameLength + extraLength + commentLength
  }
  expect(cursor).toBe(end)
  return { bytes, files }
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('reconcileScorecardGroups', () => {
  it('initializes independent empty range pairs and stable three-part keys', () => {
    const planned = [group(), group({ bowType: 'recurve', participantCount: 1, rounds: [{ key: 'gold', label: '金牌赛', target_counts: [1, 2] }] })]
    const result = reconcileScorecardGroups([], planned)
    expect(result[0]).toMatchObject({ key: '["barebow","30m","men"]', ranges: { '1/2': ['', ''], gold: ['', ''] }, pdf: null, url: '', error: '' })
    expect(result[1]).toMatchObject({ participantCount: 1, rounds: [], ranges: {}, pdf: null, url: '' })
    result[0].ranges.gold[0] = 10
    expect(result[0].ranges['1/2']).toEqual(['', ''])
    expect(planned[1].rounds).toHaveLength(1)
  })

  it('preserves configuration, PDF Blob, URL and error for unchanged members/count/rounds', () => {
    const previous = filledGroup()
    const [next] = reconcileScorecardGroups([previous], [group({ label: '更新后的展示名称' })])
    expect(next.label).toBe('更新后的展示名称')
    expect(next.ranges).toEqual(previous.ranges)
    expect(next.ranges).not.toBe(previous.ranges)
    expect(next.ranges.gold).not.toBe(previous.ranges.gold)
    expect(next.pdf).toBe(previous.pdf)
    expect(next.url).toBe(previous.url)
    expect(next.error).toBe(previous.error)
    next.ranges.gold[0] = 8
    next.rounds[0].target_counts[0] = 100
    expect(previous.ranges.gold).toEqual([7, 7])
    expect(previous.rounds[0].target_counts).toEqual([2, 4])
  })

  it('matches by identity rather than ordering and omits removed groups', () => {
    const men = filledGroup()
    const women = filledGroup({ genderGroup: 'women', fingerprint: 'members-women' })
    women.url = 'blob:women'
    const result = reconcileScorecardGroups([men, women], [group({ genderGroup: 'women', fingerprint: 'members-women' }), group()])
    expect(result.map(item => item.url)).toEqual(['blob:women', 'blob:existing-pdf'])
    expect(reconcileScorecardGroups([men, women], [group()])).toHaveLength(1)
    expect(reconcileScorecardGroups([men], [])).toEqual([])
  })

  it.each([
    { fingerprint: 'different-members' }, { fingerprint: '' }, { fingerprint: undefined }, { participantCount: 5 },
    { bowType: 'longbow' }, { distance: '50m' }, { genderGroup: 'women' },
    { rounds: [{ key: 'gold', label: '金牌赛', target_counts: [1, 2] }] },
    { rounds: [{ key: '1/2', label: '半决赛', target_counts: [2, 8] }, { key: 'gold', label: '金牌赛', target_counts: [1, 2] }] },
    { rounds: [{ key: '1/2', label: '四强赛', target_counts: [2, 4] }, { key: 'gold', label: '金牌赛', target_counts: [1, 2] }] },
    { rounds: [{ key: 'gold', label: '金牌赛', target_counts: [1, 2] }, { key: '1/2', label: '半决赛', target_counts: [2, 4] }] },
    { rounds: [{ key: 'bronze', label: '铜牌赛', target_counts: [1, 2] }] },
  ])('resets every artifact and range when input changes %#', changes => {
    const previous = filledGroup()
    const [result] = reconcileScorecardGroups([previous], [group(changes)])
    expect(result.pdf).toBeNull()
    expect(result.url).toBe('')
    expect(result.error).toBe('')
    expect(Object.values(result.ranges).every(pair => pair[0] === '' && pair[1] === '')).toBe(true)
    expect(previous.url).toBe('blob:existing-pdf')
  })

  it('keeps one-person and empty groups as hints with no rounds', () => {
    const previous = filledGroup()
    const result = reconcileScorecardGroups([previous], [group({ participantCount: 1 }), group({ genderGroup: 'women', participantCount: 0, rounds: [] })])
    expect(result.map(item => [item.participantCount, item.rounds, item.ranges, item.pdf])).toEqual([[1, [], {}, null], [0, [], {}, null]])
  })

  it('preserves partial range edits and does not mutate supplied plans', () => {
    const previous = filledGroup()
    previous.ranges = { gold: ['', 9] }
    const planned = group()
    const [next] = reconcileScorecardGroups([previous], [planned])
    expect(next.ranges).toEqual({ '1/2': ['', ''], gold: ['', 9] })
    next.rounds[0].target_counts[1] = 99
    expect(planned.rounds[0].target_counts).toEqual([2, 4])
  })

  it('does not create or revoke URLs and supports names that resemble object properties', () => {
    const create = vi.fn(); const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const previous = filledGroup()
    const [result] = reconcileScorecardGroups([previous], [group({ rounds: [{ key: '__proto__', label: '轮次', target_counts: [1, 2] }] })])
    expect(Object.hasOwn(result.ranges, '__proto__')).toBe(true)
    expect(Object.getPrototypeOf(result.ranges)).toBe(Object.prototype)
    expect(result.ranges.__proto__).toEqual(['', ''])
    expect(create).not.toHaveBeenCalled(); expect(revoke).not.toHaveBeenCalled()
  })

  it('rejects duplicate identities and malformed new plans', () => {
    expect(() => reconcileScorecardGroups([], [group(), group()])).toThrow('分组重复')
    expect(() => reconcileScorecardGroups({}, [])).toThrow('分组数据无效')
    expect(() => reconcileScorecardGroups([], [group({ participantCount: NaN })])).toThrow('分组数据无效')
    expect(() => reconcileScorecardGroups([], [group({ bowType: '' })])).toThrow('分组数据无效')
    expect(() => reconcileScorecardGroups([], [group({ rounds: [{ key: 'gold', label: '金牌赛', target_counts: [0, 2] }] })])).toThrow('轮次数据无效')
    expect(() => reconcileScorecardGroups([], [group({ rounds: [group().rounds[0], group().rounds[0]] })])).toThrow('轮次数据无效')
  })
})

describe('buildScorecardZip UTF-8 archive', () => {
  it('writes real Chinese filenames, binary PDF payloads, UTF-8 flags and correct CRCs readable by CFB', async () => {
    const payloads = [new TextEncoder().encode('%PDF-1.7\n排位赛'), Uint8Array.from({ length: 256 }, (_, index) => index)]
    const names = ['第一天_光弓30米_排位赛.pdf', '第二天_传统弓18米_淘汰赛🏹.pdf']
    const entries = names.map((name, index) => ({ name, blob: new Blob([payloads[index]], { type: 'application/pdf' }) }))
    const archive = await buildScorecardZip(entries)
    expect(archive).toBeInstanceOf(Blob)
    expect(archive.type).toBe('application/zip')
    const { bytes, files } = await readZip(archive)
    expect(files.map(file => file.name)).toEqual(names)
    files.forEach((file, index) => {
      expect(Array.from(file.bytes)).toEqual(Array.from(payloads[index]))
      expect(file.nameLength).toBe(new TextEncoder().encode(names[index]).length)
      expect(file.nameLength).toBeGreaterThan(names[index].length)
    })
    const unpacked = CFB.read(bytes, { type: 'array' })
    const extracted = new Map()
    unpacked.FileIndex.forEach((file, index) => {
      if (file.type !== 2 || !unpacked.FullPaths[index].endsWith('.pdf')) return
      const rawName = unpacked.FullPaths[index].slice(unpacked.FullPaths[0].length)
      const name = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(rawName, char => char.charCodeAt(0)))
      extracted.set(name, new Uint8Array(file.content))
    })
    expect([...extracted.keys()]).toEqual(names)
    names.forEach((name, index) => expect(Array.from(extracted.get(name))).toEqual(Array.from(payloads[index])))
    expect(entries.map(entry => entry.name)).toEqual(names)
  })

  it('supports empty archives, empty files and the standard CRC32 check vector', async () => {
    const empty = await buildScorecardZip([])
    expect(empty.size).toBe(22)
    expect((await readZip(empty)).files).toEqual([])
    const archive = await buildScorecardZip([{ name: 'empty.pdf', blob: new Blob([]) }, { name: 'checksum.pdf', blob: new Blob(['123456789']) }])
    const { files } = await readZip(archive)
    expect(files[0].bytes).toHaveLength(0)
    expect(files[0].crc).toBe(0)
    expect(files[1].crc).toBe(0xcbf43926)
  })

  it('resolves duplicate and case-insensitive filenames without overwriting any payload', async () => {
    const names = ['组别.pdf', '组别.pdf', '组别 (2).pdf', '组别.PDF']
    const { files } = await readZip(await buildScorecardZip(names.map((name, index) => ({ name, blob: new Blob([String(index)]) }))))
    expect(files.map(file => file.name)).toEqual(['组别.pdf', '组别 (2).pdf', '组别 (2) (2).pdf', '组别 (3).PDF'])
    expect(files.map(file => new TextDecoder().decode(file.bytes))).toEqual(['0', '1', '2', '3'])
  })

  it('flattens traversal and absolute paths, strips control names and avoids Windows special files', async () => {
    const names = ['/目录/手卡.pdf', '..\\..\\手卡.pdf', 'C:\\站位\\另一组.pdf', '../../..', '/tmp/./', 'NUL.pdf', 'CON', '..隐藏.pdf', '危险\u0000:\t?.pdf']
    const { files } = await readZip(await buildScorecardZip(names.map(name => ({ name, blob: new Blob(['pdf']) }))))
    expect(files.map(file => file.name)).toEqual(['手卡.pdf', '手卡 (2).pdf', '另一组.pdf', '记分纸.pdf', '记分纸 (2).pdf', '_NUL.pdf', '_CON', '隐藏.pdf', '危险__.pdf'])
    for (const file of files) {
      expect(file.name).not.toMatch(/[\\/:*?"<>|]/)
      expect(file.name.startsWith('.')).toBe(false)
      expect(file.name).not.toContain('\u0000')
    }
  })

  it('deduplicates normalized Unicode and malformed-surrogate spellings before encoding', async () => {
    const names = ['e\u0301.pdf', 'é.pdf', '\ud800.pdf', '\ud801.pdf']
    const { files } = await readZip(await buildScorecardZip(names.map(name => ({ name, blob: new Blob(['x']) }))))
    expect(files.map(file => file.name)).toEqual(['é.pdf', 'é (2).pdf', '�.pdf', '� (2).pdf'])
  })

  it('uses Blob.arrayBuffer when available without requiring FileReader', async () => {
    const blob = new Blob(['payload'])
    const arrayBuffer = vi.fn(async () => new TextEncoder().encode('payload').buffer)
    Object.defineProperty(blob, 'arrayBuffer', { value: arrayBuffer })
    const archive = await buildScorecardZip([{ name: '单组.pdf', blob }])
    expect(arrayBuffer).toHaveBeenCalledOnce()
    expect(new TextDecoder().decode((await readZip(archive)).files[0].bytes)).toBe('payload')
  })

  it('rejects invalid entries, oversized names and ZIP64 sizes before reading payloads', async () => {
    await expect(buildScorecardZip(null)).rejects.toThrow('清单无效')
    await expect(buildScorecardZip([null])).rejects.toThrow('无效文件')
    await expect(buildScorecardZip([{ name: 'x.pdf', blob: 'not a Blob' }])).rejects.toThrow('无效文件')
    await expect(buildScorecardZip(new Array(0xffff))).rejects.toThrow('ZIP64')
    await expect(buildScorecardZip([{ name: '弓'.repeat(22000) + '.pdf', blob: new Blob(['x']) }])).rejects.toThrow('文件名过长')
    const huge = new Blob([])
    const read = vi.fn()
    Object.defineProperty(huge, 'size', { value: 0xffffffff })
    Object.defineProperty(huge, 'arrayBuffer', { value: read })
    await expect(buildScorecardZip([{ name: 'huge.pdf', blob: huge }])).rejects.toThrow('ZIP64')
    expect(read).not.toHaveBeenCalled()
  })

  it('does not return partial archives when a blob fails or returns truncated bytes', async () => {
    const broken = new Blob(['x'])
    Object.defineProperty(broken, 'arrayBuffer', { value: async () => { throw new Error('读取失败') } })
    await expect(buildScorecardZip([{ name: 'ok.pdf', blob: new Blob(['ok']) }, { name: 'broken.pdf', blob: broken }])).rejects.toThrow('读取失败')
    const truncated = new Blob(['abc'])
    Object.defineProperty(truncated, 'arrayBuffer', { value: async () => new ArrayBuffer(1) })
    await expect(buildScorecardZip([{ name: 'truncated.pdf', blob: truncated }])).rejects.toThrow('读取不完整')
  })

  it('captures names and the entry list before asynchronous blob reads', async () => {
    let finish
    const first = new Blob(['a'])
    Object.defineProperty(first, 'arrayBuffer', { value: () => new Promise(resolve => { finish = () => resolve(new TextEncoder().encode('a').buffer) }) })
    const entries = [{ name: '原始一.pdf', blob: first }, { name: '原始二.pdf', blob: new Blob(['b']) }]
    const pending = buildScorecardZip(entries)
    entries[0].name = '被改名.pdf'
    entries.pop()
    entries.push({ name: '替换项.pdf', blob: new Blob(['new']) })
    finish()
    const { files } = await readZip(await pending)
    expect(files.map(file => file.name)).toEqual(['原始一.pdf', '原始二.pdf'])
    expect(files.map(file => new TextDecoder().decode(file.bytes))).toEqual(['a', 'b'])
  })

  it('never creates or revokes URLs and leaves downloading to the caller', async () => {
    const create = vi.fn(); const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    await buildScorecardZip([{ name: '记分纸.pdf', blob: new Blob(['pdf']) }])
    expect(create).not.toHaveBeenCalled(); expect(revoke).not.toHaveBeenCalled()
  })
})
