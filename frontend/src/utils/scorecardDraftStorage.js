const WORKBOOKS = 'workbooks'
const CONFIGURATIONS = 'configurations'
const STORES = [WORKBOOKS, CONFIGURATIONS]
let connection

function openDatabase() {
  if (connection) return connection

  const clearConnection = () => {
    if (connection === pending) connection = undefined
  }
  const pending = new Promise((resolve, reject) => {
    const indexedDB = globalThis.indexedDB
    if (!indexedDB) throw new Error('IndexedDB is unavailable')

    const request = indexedDB.open('scorecard-drafts', 1)
    let blocked = false
    request.onblocked = () => {
      blocked = true
      reject(new Error('Opening scorecard draft storage is blocked'))
    }
    request.onerror = () => reject(request.error ?? new Error('Could not open scorecard draft storage'))
    request.onupgradeneeded = () => {
      for (const store of STORES) request.result.createObjectStore(store)
    }
    request.onsuccess = () => {
      const db = request.result
      if (blocked) {
        db.close() // A blocked open request can still succeed after we reject.
        return
      }
      db.onclose = clearConnection
      db.onversionchange = () => {
        db.close()
        clearConnection()
      }
      resolve(db)
    }
  })
  connection = pending
  pending.catch(clearConnection)
  return pending
}

async function transact(stores, mode, work) {
  // Operations awaiting the same connection create their transactions in call order.
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(stores, mode)
    let result
    let error
    transaction.oncomplete = () => resolve(result)
    transaction.onerror = event => { error ??= event.target.error }
    transaction.onabort = () => reject(error ?? transaction.error ?? new Error('Scorecard draft transaction aborted'))

    try {
      result = work(transaction)
    } catch (reason) {
      // A synchronous write failure (e.g. DataCloneError) must roll back earlier requests.
      error = reason
      try { transaction.abort() } catch { reject(reason) }
    }
  })
}

export async function loadScorecardDraft(eventId) {
  const [workbook, configuration] = await transact(STORES, 'readonly', transaction => [
    transaction.objectStore(WORKBOOKS).get(eventId),
    transaction.objectStore(CONFIGURATIONS).get(eventId),
  ])
  return workbook.result === undefined ? null : { workbook: workbook.result, configuration: configuration.result }
}

export function saveScorecardWorkbook(eventId, workbook, configuration) {
  return transact(STORES, 'readwrite', transaction => {
    transaction.objectStore(WORKBOOKS).put(workbook, eventId)
    transaction.objectStore(CONFIGURATIONS).put(configuration, eventId)
  })
}

export function saveScorecardConfiguration(eventId, configuration) {
  return transact([CONFIGURATIONS], 'readwrite', transaction => {
    transaction.objectStore(CONFIGURATIONS).put(configuration, eventId)
  })
}

export function deleteScorecardDraft(eventId) {
  return transact(STORES, 'readwrite', transaction => {
    transaction.objectStore(WORKBOOKS).delete(eventId)
    transaction.objectStore(CONFIGURATIONS).delete(eventId)
  })
}
