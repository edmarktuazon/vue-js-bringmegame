// firebase/gameHelpers.js
import { ref } from 'vue'
import { db, storage } from '/firebase/config'
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
    const imgRef = storageRef(storage, `submissions/${gameId}/${userId}/prompt_${promptIndex}.jpg`)

    // Upload file
    await uploadBytes(imgRef, file)
    const photoUrl = await getDownloadURL(imgRef)

    // Save submission
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
        uploadedAt: serverTimestamp(), // ✅ Para sa listenToSubmissions order
      },
      { merge: true },
    )

    console.log(`Upload successful for prompt ${promptIndex}`)
    return photoUrl
  } catch (error) {
    console.error('Error submitting photo:', error)
    throw error
  }
}

export const getActiveGame = async () => {
  try {
    const q = query(collection(db, 'games'), where('isActive', '==', true), limit(1))
    const snapshot = await getDocs(q)
    if (snapshot.empty) return null
    const gameDoc = snapshot.docs[0]
    return { id: gameDoc.id, ...gameDoc.data() }
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
    // Deactivate all previous active games
    const activeQuery = query(collection(db, 'games'), where('isActive', '==', true))
    const activeSnap = await getDocs(activeQuery)

    const batch = writeBatch(db)

    activeSnap.forEach((doc) => {
      batch.update(doc.ref, { isActive: false })
    })

    // Create new game — ACTIVE agad kapag may prompts!
    const newGameRef = doc(collection(db, 'games'))
    const newGameData = {
      prompts: prompts.map((p) => p.trim()),
      status: 'active', // ← AGAD ACTIVE!
      isActive: true,
      createdBy: createdByEmail,
      createdAt: serverTimestamp(),
      prize: { description: '', logoUrl: '' },
    }

    batch.set(newGameRef, newGameData)
    await batch.commit()

    console.log('New game created and STARTED:', newGameRef.id)
    return { id: newGameRef.id, ...newGameData }
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

  // Kung gusto maging active PERO WALANG 3 PROMPTS → block!
  if (newStatus === 'active') {
    const prompts = data.prompts || []
    const valid =
      Array.isArray(prompts) && prompts.length === 3 && prompts.every((p) => p && p.trim())
    if (!valid) {
      throw new Error('Cannot start game without 3 prompts! Use "Create and Start Game" button.')
    }
  }

  // Kung mag-e-end, okay lang kahit walang prompts
  await updateDoc(gameRef, { status: newStatus })

  console.log('Status updated to:', newStatus)
}
export const updatePrize = async (gameId, description, logoFile) => {
  try {
    let logoUrl = ''
    if (logoFile) {
      const fileRef = ref(storage, `games/${gameId}/prizes/logo.jpg`)
      await uploadBytes(fileRef, logoFile)
      logoUrl = await getDownloadURL(fileRef)
    }

    await updateDoc(doc(db, 'games', gameId), {
      'prize.description': description,
      ...(logoUrl ? { 'prize.logoUrl': logoUrl } : {}),
    })

    console.log('Prize updated')
    return logoUrl
  } catch (error) {
    console.error('Error updating prize:', error)
    throw error
  }
}

// ============================================
// USER FUNCTIONS
// ============================================

export const createUser = async (instagramHandle) => {
  try {
    const q = query(collection(db, 'users'), where('instagramHandle', '==', instagramHandle))
    const snapshot = await getDocs(q)

    if (!snapshot.empty) {
      const userDoc = snapshot.docs[0]
      return { id: userDoc.id, ...userDoc.data() }
    }

    const userRef = doc(collection(db, 'users'))
    const userData = {
      instagramHandle,
      joinedAt: serverTimestamp(),
      hasJoined: true,
      currentGameId: null,
    }

    await setDoc(userRef, userData)
    console.log('User created:', userRef.id)
    return { id: userRef.id, ...userData }
  } catch (error) {
    console.error('Error creating user:', error)
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
// SUBMISSION FUNCTIONS (FIXED PATHS!)
// ============================================

// FIXED: Correct path to subcollection
// BEST & FASTEST FIX – no need for new index!
export const getUserSubmissions = async (gameId, userId) => {
  const q = query(collection(db, 'games', gameId, 'submissions'), where('userId', '==', userId))

  const snapshot = await getDocs(q)

  const result = {}

  snapshot.forEach((doc) => {
    const data = doc.data()

    // 🔑 KEY FIX HERE
    result[data.promptIndex] = {
      id: doc.id,
      ...data,
    }
  })

  return result
}

// FIXED: Real-time admin submissions (use in AdminView with onSnapshot)
export const listenToSubmissions = (gameId, callback) => {
  const q = query(collection(db, 'games', gameId, 'submissions'), orderBy('uploadedAt', 'desc'))

  return onSnapshot(q, (snapshot) => {
    const subs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
    callback(subs)
  })
}

export const updateSubmissionStatus = async (submissionId, status, adminEmail, gameId) => {
  try {
    const submissionRef = doc(db, 'games', gameId, 'submissions', submissionId)
    await updateDoc(submissionRef, {
      status,
      reviewedBy: adminEmail,
      reviewedAt: serverTimestamp(),
    })
    console.log('Submission updated:', status)
  } catch (error) {
    console.error('Error updating submission:', error)
    throw error
  }
}

// ============================================
// LEADERBOARD (Optional – keep if needed)
// ============================================

export const getLeaderboard = async (gameId) => {
  try {
    const q = query(
      collection(db, 'games', gameId, 'submissions'),
      where('status', '==', 'approved'),
    )
    const snapshot = await getDocs(q)

    const userTimes = {}
    snapshot.forEach((doc) => {
      const data = doc.data()
      if (!userTimes[data.userId]) {
        userTimes[data.userId] = {
          instagramHandle: data.instagramHandle,
          times: [],
        }
      }
      if (data.uploadedAt) {
        userTimes[data.userId].times.push(data.uploadedAt.toMillis())
      }
    })

    const leaderboard = Object.entries(userTimes)
      .map(([userId, info]) => {
        if (info.times.length !== 3) return null
        const totalTime = Math.max(...info.times) - Math.min(...info.times)
        return { userId, instagramHandle: info.instagramHandle, totalTime }
      })
      .filter(Boolean)
      .sort((a, b) => a.totalTime - b.totalTime)
      .map((entry, index) => ({ rank: index + 1, ...entry }))

    return leaderboard
  } catch (error) {
    console.error('Error getting leaderboard:', error)
    return []
  }
}
