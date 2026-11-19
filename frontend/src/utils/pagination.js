// All paginated management lists return stable record IDs. Do not present a partial
// review as complete if the list changed during paging or the server stopped advancing.
export async function getAllPages(fetchPage, params = {}, pageSize = 100) {
  const records = []
  const ids = new Set()
  let expectedTotal

  for (let page = 1; ; page += 1) {
    const response = await fetchPage({ ...params, page, page_size: pageSize })
    const items = response?.items
    const total = response?.total
    if (!Array.isArray(items) || items.length > pageSize ||
        (total != null && (!Number.isSafeInteger(total) || total < 0 ||
          (expectedTotal != null && total !== expectedTotal)))) {
      throw new Error('分页数据不一致，请重试')
    }
    expectedTotal ??= total
    for (const record of items) {
      if (record?.id == null || ids.has(record.id)) throw new Error('分页记录有重复或缺少编号，请重试')
      ids.add(record.id)
      records.push(record)
    }
    if (expectedTotal != null) {
      if (records.length === expectedTotal) return records
      if (records.length > expectedTotal || items.length < pageSize) throw new Error('分页数据不完整，请重试')
    } else if (items.length < pageSize) {
      return records
    }
  }
}
