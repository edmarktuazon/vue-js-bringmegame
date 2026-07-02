import { db } from '/firebase/config'
import {
  collection,
  doc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'

export const saveNotifySubscriber = async (instagramHandle, gameId) => {
  try {
    if (!instagramHandle || !gameId) {
      throw new Error('Missing instagram handle or game id')
    }

    const subRef = doc(collection(db, 'notifySubscribers'))

    await setDoc(subRef, {
      instagramHandle,
      gameId,
      createdAt: serverTimestamp(),
    })

    return { success: true }
  } catch (error) {
    console.error('Error saving notify subscriber:', error)
    return { success: false, error: error.message }
  }
}

// Real-time listener for the admin table, all subscribers for a given game
export const listenToNotifySubscribers = (gameId, callback) => {
  if (!gameId) {
    callback([])
    return () => {}
  }

  const q = query(
    collection(db, 'notifySubscribers'),
    where('gameId', '==', gameId),
    orderBy('createdAt', 'desc'),
  )

  return onSnapshot(
    q,
    (snapshot) => {
      const subs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
      callback(subs)
    },
    (error) => {
      console.error('Error listening to notify subscribers:', error)
    },
  )
}

// Delete a single subscriber entry (admin action, e.g. after the game is done)
export const deleteNotifySubscriber = async (subId) => {
  try {
    await deleteDoc(doc(db, 'notifySubscribers', subId))
    return { success: true }
  } catch (error) {
    console.error('Error deleting notify subscriber:', error)
    return { success: false, error: error.message }
  }
}

// Delete ALL subscriber entries for a given game (admin "Clear All" action)
export const deleteAllNotifySubscribers = async (gameId) => {
  try {
    const q = query(collection(db, 'notifySubscribers'), where('gameId', '==', gameId))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return { success: true, count: 0 }

    const batch = writeBatch(db)
    snapshot.forEach((d) => batch.delete(d.ref))
    await batch.commit()

    return { success: true, count: snapshot.size }
  } catch (error) {
    console.error('Error clearing notify subscribers:', error)
    return { success: false, error: error.message }
  }
}

// Format a Firestore Timestamp into AEST (Melbourne, GMT+10/11) date + time strings
export const formatAEST = (timestamp) => {
  const ms = timestamp?.toMillis ? timestamp.toMillis() : null
  if (!ms) return { date: '-', time: '-' }

  const d = new Date(ms)

  const date = d.toLocaleDateString('en-AU', {
    timeZone: 'Australia/Melbourne',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })

  const time = d.toLocaleTimeString('en-AU', {
    timeZone: 'Australia/Melbourne',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })

  return { date, time: `${time} AEST` }
}

// ---- Melbourne (AEST/AEDT) datetime-local helpers ----
// These make the "Next Game Countdown" input behave as Melbourne wall-clock
// time regardless of the admin's own device/browser timezone.

const MELBOURNE_TZ = 'Australia/Melbourne'

// "YYYY-MM-DDTHH:mm" (from a datetime-local input) -> correct UTC millis,
// treating the typed value as Melbourne time.
export const melbourneInputToUTCMillis = (dateTimeLocalStr) => {
  if (!dateTimeLocalStr) return null

  const [datePart, timePart] = dateTimeLocalStr.split('T')
  const [year, month, day] = datePart.split('-').map(Number)
  const [hour, minute] = timePart.split(':').map(Number)

  const guessUTC = Date.UTC(year, month - 1, day, hour, minute)

  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(guessUTC))
  const get = (type) => Number(parts.find((p) => p.type === type).value)

  const renderedHour = get('hour') === 24 ? 0 : get('hour')
  const renderedAsUTC = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    renderedHour,
    get('minute'),
  )

  const correction = guessUTC - renderedAsUTC
  return guessUTC + correction
}

// UTC millis -> "YYYY-MM-DDTHH:mm" representing that instant's Melbourne
// wall-clock time, for pre-filling the datetime-local input.
export const utcMillisToMelbourneInput = (ms) => {
  if (!ms) return ''

  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: MELBOURNE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date(ms))
  const get = (type) => parts.find((p) => p.type === type).value

  const hour = get('hour') === '24' ? '00' : get('hour')

  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`
}
