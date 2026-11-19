import templateUrl from '../assets/season-export-template.xlsx?url'
import { downloadWorkbook, getBowPalette, getStationLabel } from './pointsWorkbook'

const DISTANCES = ['50M', '30M', '18M', '10M']
const FORMATS = ['ranking', 'elimination', 'team', 'mixed_doubles']
const FORMAT_LABELS = ['排位赛', '淘汰赛', '团体赛', '混双赛']
const POINT_FORMAT_ID = 164

// Round each component half up before summing integer tenths. Parsing decimal
// digits avoids binary floating-point errors at boundaries such as 1.15.
export const pointTenths = value => {
  const text = String(value ?? 0).trim()
  const match = text.match(/^([+-]?)(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i)
  if (!match || !Number.isFinite(Number(text))) throw new Error('积分数据无效')
  const [, sign, integer, fraction = '', exponent = '0'] = match
  const length = integer.length + Number(exponent) + 1
  if (length < 0) return 0
  const digits = integer + fraction
  const tenths = Number(digits.padEnd(length, '0').slice(0, length) || '0')
  const roundUp = Number(digits[length] || '0') >= 5
  return (sign === '-' ? -1 : 1) * (tenths + Number(roundUp))
}

export const sumPointTenths = scores => scores.reduce((sum, score) => sum + pointTenths(score.points), 0)

const escapeXml = value => String(value ?? '')
  // XML 1.0 forbids these control characters in inline strings.
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;')

const cellXml = (column, row, value, style) => {
  const ref = String.fromCharCode(65 + column) + row
  const attrs = 'r="' + ref + '" s="' + style + '"'
  if (value === '') return '<c ' + attrs + '/>'
  if (typeof value === 'number') return '<c ' + attrs + '><v>' + value + '</v></c>'
  // inlineStr prevents names beginning with '=' from becoming formulas.
  return '<c ' + attrs + ' t="inlineStr"><is><t xml:space="preserve">' + escapeXml(value) + '</t></is></c>'
}

/**
 * SheetJS CE's worksheet writer drops custom cell styles. Use its existing CFB
 * ZIP API to retain the template fonts, fills, borders, row layout and merges.
 */
export function buildSeasonWorkbook(XLSX, template, { ranking, eventId, eventLabel, year, bowType, bowTypeLabel }) {
  const zip = XLSX.CFB.read(new Uint8Array(template), { type: 'array' })
  const decoder = new TextDecoder()
  const getXml = path => {
    const file = XLSX.CFB.find(zip, '/' + path)
    if (!file) throw new Error('赛季导出模板不完整')
    return decoder.decode(new Uint8Array(file.content))
  }
  const putXml = (path, xml) => XLSX.CFB.utils.cfb_add(zip, '/' + path, new TextEncoder().encode(xml))

  const stationLabel = getStationLabel(eventLabel)
  const palette = getBowPalette(bowType, bowTypeLabel)
  const title = '杭州弓箭俱乐部冠军联赛\n' + (year || '') + '赛季' + stationLabel + (bowTypeLabel || '') + '积分排名'
  const titleRow = [title, ...Array(19).fill('')]
  const header = ['排名', '姓名', '俱乐部', ...DISTANCES.flatMap(distance => [distance, '', '', '']), stationLabel + '积分']
  const subHeader = ['', '', '', ...DISTANCES.flatMap(() => FORMAT_LABELS), '']
  const rows = [titleRow, header, subHeader]
  ranking.forEach(athlete => {
    const scores = (athlete.scores || []).filter(score => String(score.event_id) === String(eventId))
    const points = new Map()
    scores.forEach(score => {
      const distance = String(score.distance || '').trim().toUpperCase()
      const distanceIndex = DISTANCES.indexOf(distance)
      const formatIndex = FORMATS.indexOf(score.format)
      if (distanceIndex < 0 || formatIndex < 0) {
        throw new Error('模板不支持的积分项目：' + distance + ' / ' + score.format)
      }
      const column = distanceIndex * FORMATS.length + formatIndex
      points.set(column, (points.get(column) || 0) + pointTenths(score.points))
    })
    rows.push([
      athlete.ranking, athlete.name || '', athlete.club || '',
      ...Array.from({ length: 16 }, (_, column) => points.has(column) ? points.get(column) / 10 : ''),
      sumPointTenths(scores) / 10,
    ])
  })

  const sheetData = rows.map((row, index) => {
    const cells = row.map((value, column) => {
      const style = index === 0 ? 6 : index < 3 ? 1 : (index % 2 === 1 ? 2 : 3) + (column >= 3 ? 2 : 0)
      return cellXml(column, index + 1, value, style)
    }).join('')
    return '<row r="' + (index + 1) + '" ht="' + (index === 0 ? 52.5 : 15.75) + '" customHeight="1" spans="1:20">' + cells + '</row>'
  }).join('')
  const merges = ['A1:T1', 'D2:G2', 'H2:K2', 'L2:O2', 'P2:S2', 'A2:A3', 'B2:B3', 'C2:C3', 'T2:T3']
  const mergeXml = '<mergeCells count="9">' + merges.map(ref => '<mergeCell ref="' + ref + '"/>').join('') + '</mergeCells>'
  const sheet = getXml('xl/worksheets/sheet1.xml')
    .replace(/<mergeCells[^>]*>[\s\S]*?<\/mergeCells>/, mergeXml)
    .replace(/<sheetData>[\s\S]*?<\/sheetData>/, '<sheetData>' + sheetData + '</sheetData>')
    .replace(/<dimension ref="[^"]*"\/>/, '<dimension ref="A1:T' + rows.length + '"/>')
  putXml('xl/worksheets/sheet1.xml', sheet)

  let styles = getXml('xl/styles.xml')
  // Only the two fills used by the template's header and striped rows change.
  // Fill 0 (white/no fill), unused palette entries and every existing style ID remain intact.
  styles = styles.replace(/(<fills\b[^>]*>)([\s\S]*?)(<\/fills>)/, (_, open, content, close) => {
    let fillIndex = 0
    const fills = content.replace(/<fill\b[^>]*>[\s\S]*?<\/fill>/g, fill => {
      const color = fillIndex === 2 ? palette.header : fillIndex === 3 ? palette.stripe : null
      fillIndex += 1
      return color ? fill.replace(/<fgColor\b[^>]*\/>/, '<fgColor rgb="' + color + '"/>') : fill
    })
    return open + fills + close
  })
  styles = styles.replace(/<numFmts count="(\d+)">/, (_, count) => '<numFmts count="' + (Number(count) + 1) + '">')
    .replace('</numFmts>', '<numFmt numFmtId="' + POINT_FORMAT_ID + '" formatCode="0.0"/></numFmts>')
  const originals = styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)[1].match(/<xf\b[^>]*>[\s\S]*?<\/xf>/g)
  const formats = [2, 3].map(index => originals[index]
    .replace('numFmtId="0"', 'numFmtId="' + POINT_FORMAT_ID + '" applyNumberFormat="1"')).join('')
  const fontCount = Number(styles.match(/<fonts count="(\d+)">/)[1])
  const headerFont = styles.match(/<fonts[^>]*>([\s\S]*?)<\/fonts>/)[1].match(/<font>[\s\S]*?<\/font>/g)[1]
    .replace(/<sz val="[^"]*"\/>/, '<sz val="16"/>')
  styles = styles.replace(/<fonts count="\d+">/, '<fonts count="' + (fontCount + 1) + '">')
    .replace('</fonts>', headerFont + '</fonts>')
  const titleStyle = originals[1].replace('fontId="1"', 'fontId="' + fontCount + '"')
    .replace(/<alignment[^>]*\/>/, '<alignment horizontal="center" vertical="center" wrapText="1"/>')
  styles = styles.replace(/<cellXfs count="(\d+)">/, (_, count) => '<cellXfs count="' + (Number(count) + 3) + '">')
    .replace('</cellXfs>', formats + titleStyle + '</cellXfs>')
  putXml('xl/styles.xml', styles)
  return new Uint8Array(XLSX.CFB.write(zip, { type: 'array', fileType: 'zip', compression: true }))
}

export async function exportSeasonPoints(XLSX, options) {
  const response = await fetch(templateUrl)
  if (!response.ok) throw new Error('赛季导出模板加载失败，请重试')
  const bytes = buildSeasonWorkbook(XLSX, await response.arrayBuffer(), options)
  return downloadWorkbook(bytes, options.filename)
}
