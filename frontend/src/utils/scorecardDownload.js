export async function pdfErrorMessage(reason) {
  if (reason instanceof Blob) {
    try { reason = JSON.parse(await reason.text()) } catch { return '未能生成 PDF，请重试。' }
  }
  if (typeof reason?.detail === 'string') return reason.detail
  if (Array.isArray(reason?.detail)) return '记分纸数据未通过校验，请核对后再试。'
  return reason?.message || '未能生成 PDF，请重试。'
}

export function createPdfUrl(blob) {
  if (!(blob instanceof Blob) || !blob.size || blob.type !== 'application/pdf') throw new Error('服务器没有返回有效的 PDF，请重试。')
  return URL.createObjectURL(blob)
}

export function startPdfDownload(url, filename) {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  try { link.click() } finally { link.remove() }
}

export function releasePdfUrl(url) {
  const revoke = URL.revokeObjectURL.bind(URL)
  // Give the browser time to start the download before releasing the URL.
  setTimeout(() => revoke(url), 1000)
}
