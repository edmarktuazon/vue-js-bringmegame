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

    console.log('⚡ Starting upload for prompt', promptIndex)

    const options = {
      maxSizeMB: 0.3,
      maxWidthOrHeight: 800,
      useWebWorker: true,
      fileType: 'image/jpeg',
      initialQuality: 0.7,
    }

    const compressedFile = await imageCompression(file, options)
    console.log('✅ Compressed:', (compressedFile.size / 1024).toFixed(0) + 'KB')

    const timestamp = Date.now()
    const filePath = `submissions/${gameId}/${userId}/${promptIndex}_${timestamp}.jpg`
    const imgRef = storageRef(storage, filePath)

    console.log('📤 Uploading to:', filePath)

    await uploadBytes(imgRef, compressedFile, {
      contentType: 'image/jpeg',
      cacheControl: 'public, max-age=31536000',
    })

    const photoUrl = await getDownloadURL(imgRef)
    console.log('✅ Upload successful, URL:', photoUrl)

    const submissionId = `${userId}_${promptIndex}`
    const submissionDocRef = doc(db, 'games', gameId, 'submissions', submissionId)

    const submissionData = {
      gameId,
      userId,
      instagramHandle,
      promptIndex: Number(promptIndex),
      photoUrl,
      status: 'pending',
      createdAt: serverTimestamp(),
      uploadedAt: serverTimestamp(),
    }

    try {
      await setDoc(submissionDocRef, submissionData, { merge: true })
      console.log('✅ Firestore saved with ID:', submissionId)
    } catch (firestoreError) {
      console.error('❌ Firestore error:', firestoreError)
    }

    return photoUrl
  } catch (error) {
    console.error('❌ Upload failed:', error)
    throw error
  }
}

export const createLocalPreview = (file) => {
  return URL.createObjectURL(file)
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
      startedAt: null,
      actualStartTime: null,
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

    await updateDoc(gameRef, {
      status: newStatus,
      startedAt: serverTimestamp(),
    })
  } else {
    await updateDoc(gameRef, { status: newStatus })
  }
}

// ✅ NEW: Set actual start time after countdown
export const setActualGameStartTime = async (gameId) => {
  const gameRef = doc(db, 'games', gameId)
  await updateDoc(gameRef, {
    actualStartTime: serverTimestamp(),
  })
  console.log('✅ Actual game start time recorded')
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

    const userRef = doc(collection(db, 'users'))
    const userData = {
      instagramHandle,
      currentGameId,
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
    console.log('📥 Getting submissions for:', { gameId, userId })

    const q = query(collection(db, 'games', gameId, 'submissions'), where('userId', '==', userId))

    const snapshot = await getDocs(q)
    console.log('📊 Found', snapshot.size, 'submissions')

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
    console.error('❌ Error getting submissions:', error)
    return {}
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
// ✅ CENTRAL TIMER - LEADERBOARD & COMPLETION
// ============================================

export const getUserCompletionTime = async (gameId, userId) => {
  try {
    // Get game to find actualStartTime
    const gameDoc = await getDoc(doc(db, 'games', gameId))
    if (!gameDoc.exists()) {
      console.error('Game not found')
      return null
    }

    const gameData = gameDoc.data()
    const gameStartTime = gameData.actualStartTime?.toMillis()

    if (!gameStartTime) {
      console.error('Game has no actualStartTime set!')
      return null
    }

    // Get all user submissions
    const q = query(collection(db, 'games', gameId, 'submissions'), where('userId', '==', userId))
    const snapshot = await getDocs(q)

    if (snapshot.size !== 3) return null

    // Find latest upload time
    let lastUploadTime = 0
    snapshot.forEach((doc) => {
      const uploadTime = doc.data().uploadedAt?.toMillis()
      if (uploadTime && uploadTime > lastUploadTime) {
        lastUploadTime = uploadTime
      }
    })

    if (!lastUploadTime) return null

    // ✅ Calculate from GAME START to completion
    const totalTime = lastUploadTime - gameStartTime

    return {
      totalTime,
      formattedTime: formatDetailedTime(totalTime),
      gameStartTime,
      completedAt: lastUploadTime,
    }
  } catch (error) {
    console.error('Error getting user completion time:', error)
    return null
  }
}

export const getLeaderboard = async (gameId, onlyApproved = false) => {
  try {
    // Get game start time
    const gameDoc = await getDoc(doc(db, 'games', gameId))
    if (!gameDoc.exists()) return []

    const gameData = gameDoc.data()
    const gameStartTime = gameData.actualStartTime?.toMillis()

    if (!gameStartTime) {
      console.warn('⚠️ Game has no actualStartTime, cannot calculate leaderboard properly')
      return []
    }

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
      // Must complete all 3 prompts
      if (info.promptIndices.size !== 3) return

      // Find when they completed (last upload)
      const completedAt = Math.max(...info.times)

      // ✅ Calculate from GAME START to completion
      const totalTime = completedAt - gameStartTime

      leaderboard.push({
        userId,
        instagramHandle: info.instagramHandle,
        totalTime,
        formattedTime: formatDetailedTime(totalTime),
        completedAt,
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
