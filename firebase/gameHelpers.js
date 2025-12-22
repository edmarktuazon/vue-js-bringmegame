import { db, storage } from '/firebase/config'
import imageCompression from 'browser-image-compression'
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore'
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'

// ============================================
// GAME FUNCTIONS
// ============================================
export const submitPhoto = async (gameId, userId, instagramHandle, promptIndex, file) => {
  try {
    if (!file) throw new Error('No file selected')

    console.log('Raw file:', file.name || 'no name', file.size, file.type || 'no type')

    // Force create a new File object with proper name and type
    // This fixes missing/wrong MIME type on mobile camera
    const fixedFile = new File([file], `prompt_${promptIndex}.jpg`, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    })

    const filePath = `submissions/${gameId}/${userId}/prompt_${promptIndex}.jpg`
    const imgRef = storageRef(storage, filePath)

    // Upload directly (no compression needed for reliability)
    await uploadBytes(imgRef, fixedFile)

    const photoUrl = await getDownloadURL(imgRef)
    console.log('Upload successful:', photoUrl)

    // Save to Firestore
    const submissionRef = doc(db, 'games', gameId, 'submissions', `${userId}_${promptIndex}`)

    await setDoc(
      submissionRef,
      {
        gameId,
        userId,
        instagramHandle,
        promptIndex,
        photoUrl,
        status: 'pending',
        createdAt: serverTimestamp(),
        uploadedAt: serverTimestamp(),
      },
      { merge: true },
    )

    return photoUrl
  } catch (error) {
    console.error('Upload failed:', error)
    console.error('Error code:', error.code)
    console.error('Error message:', error.message)
    throw error
  }
}

export const getActiveGame = async () => {
  try {
    const q = query(collection(db, 'games'), where('isActive', '==', true), limit(1))
    const snapshot = await getDocs(q)
    if (snapshot.empty) {
      return null
    }
    const gameDoc = snapshot.docs[0]
    const gameData = { id: gameDoc.id, ...gameDoc.data() }
    return gameData
  } catch (error) {
    console.error('Error getting active game:', error)
    throw error
  }
}

export const createGame = async (prompts, createdByEmail) => {
  if (!prompts || prompts.length !== 3 || prompts.some((p) => !p.trim())) {
    throw new Error('Exactly 3 non-empty prompts are required')
  }

  try {
    const activeQuery = query(collection(db, 'games'), where('isActive', '==', true))
    const activeSnap = await getDocs(activeQuery)

    const batch = writeBatch(db)

    activeSnap.forEach((doc) => {
      batch.update(doc.ref, { isActive: false })
    })

    const newGameRef = doc(collection(db, 'games'))
    const newGameData = {
      prompts: prompts.map((p) => p.trim()),
      status: 'waiting',
      isActive: true,
      createdBy: createdByEmail,
      createdAt: serverTimestamp(),
      startedAt: serverTimestamp(),
      prize: { description: '', logoUrl: '' },
    }

    batch.set(newGameRef, newGameData)
    await batch.commit()

    return {
      id: newGameRef.id,
      ...newGameData,
    }
  } catch (error) {
    console.error('Error creating game:', error)
    throw error
  }
}

export const updateGameStatus = async (gameId, newStatus) => {
  const gameRef = doc(db, 'games', gameId)
  const snap = await getDoc(gameRef)
  if (!snap.exists()) throw new Error('Game not found')

  const data = snap.data()

  if (newStatus === 'active') {
    const prompts = data.prompts || []
    const valid =
      Array.isArray(prompts) && prompts.length === 3 && prompts.every((p) => p && p.trim())
    if (!valid) {
      throw new Error('Cannot start game without 3 prompts! Use "Create and Start Game" button.')
    }
  }

  await updateDoc(gameRef, { status: newStatus })
}

export const updatePrize = async (gameId, description, logoFile) => {
  try {
    let logoUrl = ''
    if (logoFile) {
      const fileRef = storageRef(storage, `games/${gameId}/prizes/logo.jpg`)
      await uploadBytes(fileRef, logoFile)
      logoUrl = await getDownloadURL(fileRef)
    }

    await updateDoc(doc(db, 'games', gameId), {
      'prize.description': description,
      ...(logoUrl ? { 'prize.logoUrl': logoUrl } : {}),
    })

    return logoUrl
  } catch (error) {
    console.error('Error updating prize:', error)
    throw error
  }
}

// ============================================
// USER FUNCTIONS
// ============================================

export const createUser = async (instagramHandle, currentGameId = null) => {
  try {
    const q = query(collection(db, 'users'), where('instagramHandle', '==', instagramHandle))
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0]
      const userData = { id: userDoc.id, ...userDoc.data() }

      if (currentGameId) {
        await updateDoc(doc(db, 'users', userDoc.id), {
          currentGameId,
          hasJoined: true,
          joinedAt: serverTimestamp(),
        })
      }

      return userData
    }

    // New user
    const userRef = doc(collection(db, 'users'))
    const userData = {
      instagramHandle,
      currentGameId, // ← save it if provided
      hasJoined: true,
      joinedAt: serverTimestamp(),
    }

    await setDoc(userRef, userData)
    console.log('New user created:', userRef.id)
    return { id: userRef.id, ...userData }
  } catch (error) {
    console.error('Error creating/updating user:', error)
    throw error
  }
}
export const updateUserCurrentGame = async (userId, gameId) => {
  try {
    await updateDoc(doc(db, 'users', userId), {
      currentGameId: gameId,
      hasJoined: true,
      lastActiveAt: serverTimestamp(),
    })
  } catch (error) {
    console.error('Error updating user game:', error)
    throw error
  }
}

// ============================================
// SUBMISSION FUNCTIONS
// ============================================

export const getUserSubmissions = async (gameId, userId) => {
  try {
    const q = query(collection(db, 'games', gameId, 'submissions'), where('userId', '==', userId))

    const snapshot = await getDocs(q)

    const result = {}

    snapshot.forEach((doc) => {
      const data = doc.data()
      result[data.promptIndex] = {
        id: doc.id,
        ...data,
      }
    })

    return result
  } catch (error) {
    console.error('Error getting user submissions:', error)
    throw error
  }
}

export const getAllSubmissions = (callback) => {
  const gamesRef = collection(db, 'games')

  return onSnapshot(gamesRef, async (gamesSnapshot) => {
    const allSubmissions = []
    const submissionPromises = []

    gamesSnapshot.docs.forEach((gameDoc) => {
      const gameId = gameDoc.id
      const subsRef = collection(db, 'games', gameId, 'submissions')

      const submissionPromise = new Promise((resolve) => {
        onSnapshot(subsRef, (subsSnapshot) => {
          const gameSubs = []
          subsSnapshot.forEach((subDoc) => {
            gameSubs.push({
              id: subDoc.id,
              gameId,
              ...subDoc.data(),
            })
          })
          resolve(gameSubs)
        })
      })

      submissionPromises.push(submissionPromise)
    })

    const allGameSubmissions = await Promise.all(submissionPromises)
    allGameSubmissions.forEach((gameSubs) => {
      allSubmissions.push(...gameSubs)
    })

    allSubmissions.sort((a, b) => {
      const timeA = a.uploadedAt?.toMillis?.() || 0
      const timeB = b.uploadedAt?.toMillis?.() || 0
      return timeB - timeA
    })

    callback(allSubmissions)
  })
}

export const listenToSubmissions = (gameId, callback) => {
  const q = query(collection(db, 'games', gameId, 'submissions'), orderBy('uploadedAt', 'desc'))

  return onSnapshot(
    q,
    (snapshot) => {
      const subs = snapshot.docs.map((doc) => ({
        id: doc.id,
        gameId,
        ...doc.data(),
      }))

      callback(subs)
    },
    (error) => {
      console.error('❌ Error in real-time listener:', error)
    },
  )
}

export const updateSubmissionStatus = async (gameId, submissionId, status, adminEmail) => {
  try {
    if (!gameId || !submissionId) {
      throw new Error('Missing gameId or submissionId')
    }

    const submissionRef = doc(db, 'games', gameId, 'submissions', submissionId)
    const submissionSnap = await getDoc(submissionRef)

    if (!submissionSnap.exists()) {
      console.error('Submission document not found:', {
        gameId,
        submissionId,
        fullPath: submissionRef.path,
      })
      throw new Error(`Submission not found: ${submissionId} in game ${gameId}`)
    }

    await updateDoc(submissionRef, {
      status,
      reviewedBy: adminEmail,
      reviewedAt: serverTimestamp(),
    })

    return true
  } catch (error) {
    console.error('❌ Failed to update submission:', error)
    throw error
  }
}

// ============================================
// LEADERBOARD
// ============================================

export const getLeaderboard = async (gameId, onlyApproved = false) => {
  try {
    let q = query(collection(db, 'games', gameId, 'submissions'))

    if (onlyApproved) {
      q = query(q, where('status', '==', 'approved'))
    }

    const snapshot = await getDocs(q)

    const userSubmissions = {}

    snapshot.forEach((doc) => {
      const data = doc.data()
      const { userId, instagramHandle, uploadedAt, promptIndex } = data

      if (!userId || !uploadedAt) return

      if (!userSubmissions[userId]) {
        userSubmissions[userId] = {
          instagramHandle,
          times: [],
          promptIndices: new Set(),
        }
      }

      const timeMs = uploadedAt.toMillis()
      userSubmissions[userId].times.push(timeMs)
      userSubmissions[userId].promptIndices.add(promptIndex)
    })

    const leaderboard = []

    Object.entries(userSubmissions).forEach(([userId, info]) => {
      if (info.promptIndices.size !== 3) return

      const startTime = Math.min(...info.times)
      const endTime = Math.max(...info.times)
      const totalTime = endTime - startTime

      leaderboard.push({
        userId,
        instagramHandle: info.instagramHandle,
        totalTime,
        formattedTime: formatDetailedTime(totalTime),
        completedAt: endTime,
      })
    })

    leaderboard.sort((a, b) => a.totalTime - b.totalTime)

    return leaderboard.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }))
  } catch (error) {
    console.error('Error getting leaderboard:', error)
    return []
  }
}

const formatTime = (ms) => {
  if (ms < 1000) return `${ms}ms`
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const millis = ms % 1000

  if (minutes > 0) {
    return `${minutes}m ${seconds.toString().padStart(2, '0')}s`
  }
  return `${seconds}s ${millis.toString().padStart(3, '0').slice(0, 1)}`
}

export const getUserCompletionTime = async (gameId, userId) => {
  try {
    const q = query(collection(db, 'games', gameId, 'submissions'), where('userId', '==', userId))
    const snapshot = await getDocs(q)

    if (snapshot.size !== 3) return null

    const times = []
    snapshot.forEach((doc) => {
      const data = doc.data()
      if (data.uploadedAt) {
        times.push(data.uploadedAt.toMillis())
      }
    })

    if (times.length !== 3) return null

    const startTime = Math.min(...times)
    const endTime = Math.max(...times)
    const totalTime = endTime - startTime

    return {
      totalTime,
      formattedTime: formatDetailedTime(totalTime),
      formatTime,
      startTime,
      endTime,
    }
  } catch (error) {
    console.error('Error getting user completion time:', error)
    return null
  }
}

export const formatDetailedTime = (ms) => {
  if (ms <= 0) return '0s 0ms'

  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000

  const minPart = minutes > 0 ? `${minutes}m ` : ''
  const secPart = `${seconds}s `
  const msPart = `${millis.toString().padStart(3, '0')}ms`

  return `${minPart}${secPart}${msPart}`.trim()
}
