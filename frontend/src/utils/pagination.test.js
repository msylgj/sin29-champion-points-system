import { describe, expect, it, vi } from 'vitest'
import { getAllPages } from './pagination'

describe('getAllPages', () => {
  it('keeps the event filter and waits for the final page', async () => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 1 }, { id: 2 }], total: 3 })
      .mockResolvedValueOnce({ items: [{ id: 3 }], total: 3 })
    expect(await getAllPages(fetchPage, { event_id: 17 }, 2)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }])
    expect(fetchPage.mock.calls).toEqual([
      [{ event_id: 17, page: 1, page_size: 2 }],
      [{ event_id: 17, page: 2, page_size: 2 }],
    ])
  })

  it('accepts an empty list and supports a final short page without a total', async () => {
    expect(await getAllPages(async () => ({ items: [], total: 0 }))).toEqual([])
    expect(await getAllPages(async () => ({ items: [{ id: 1 }] }))).toEqual([{ id: 1 }])
  })

  it.each([
    { items: [{ id: 1 }], total: 2 },
    { items: [{ id: 2 }], total: 3 },
    { items: [], total: 2 },
    { items: [{ name: 'missing id' }], total: 2 },
  ])('rejects a changing or incomplete list instead of showing partial results', async secondPage => {
    const fetchPage = vi.fn()
      .mockResolvedValueOnce({ items: [{ id: 1 }], total: 2 })
      .mockResolvedValueOnce(secondPage)
    await expect(getAllPages(fetchPage, {}, 1)).rejects.toThrow('分页')
  })
})
