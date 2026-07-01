import { db } from '/firebase/config'
import {
  collection,
  doc,
  setDoc,
  getDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore'

// Save an IG handle that wants to be notified for a specific game
export const saveNotifySubscriber = async (instagramHandle, gameId) => {
  try {
    if (!instagramHandle || !gameId) {
      throw new Error('Missing instagram handle or game id')
    }

    // one entry per handle per game (prevents duplicate spam entries)
    const cleanHandle = instagramHandle.replace('@', '').toLowerCase()
    const docId = `${gameId}_${cleanHandle}`
    const subRef = doc(db, 'notifySubscribers', docId)

    const existing = await getDoc(subRef)
    if (existing.exists()) {
      return { success: true, alreadyExists: true }
    }

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

// Real-time listener for admin table and all subscribers for a given game
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

// Format a Firestore Timestamp into AEST (Melbourne, GMT+10) date + time strings
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
