<script setup>
import { ref, onMounted, computed, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  getActiveGame,
  getUserSubmissions,
  submitPhoto,
  getUserCompletionTime,
} from '/firebase/gameHelpers'
import { db } from '/firebase/config'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'

import NavigationGame from '../components/game/NavigationGame.vue'
import CountdownOverlay from '../components/game/CountdownOverlay.vue'
import LiveFeed from '../components/game/LiveFeed.vue'
import ActiveActualGame from '../components/game/ActiveActualGame.vue'
import GameEnded from '../components/game/GameEnded.vue'
import ExitGameModal from '../components/game/ExitGameModal.vue'
import CompletionModal from '../components/game/CompletionModal.vue'

// routes
const router = useRouter()

// Player
const user = ref(null)

// Actual game
const game = ref(null)

// Submission
const submissions = ref({})

// Loading state
const loading = ref(true)

// Prompt uploading
const uploadingPrompt = ref(null)

// Selected photo
const selectedPhotoFile = ref(null)

// Live users
const liveFeed = ref([])

const showExitGameModal = ref(false)
const isLoggingOut = ref(false)

// Countdown state
const showCountdown = ref(false)
const countdown = ref(30)
const countdownInterval = ref(null)

// Timer state
const timerInterval = ref(null)

// Completion modal
const showCompletionModal = ref(false)
const completionTime = ref(null)

let unsubscribeGame = null
let unsubscribeFeed = null

onMounted(async () => {
  console.log('🎮 Game component mounted')

  const userStr = localStorage.getItem('bmg_user')
  if (!userStr) {
    console.log('❌ No user found in localStorage')
    router.push('/')
    return
  }

  user.value = JSON.parse(userStr)
  console.log('✅ User loaded:', user.value)

  // Sign in anonymously to enable Firebase Storage uploads
  try {
    console.log('🔐 Authenticating with Firebase...')
    const { signInAnonymously } = await import('firebase/auth')
    const { auth } = await import('/firebase/config')
    const result = await signInAnonymously(auth)
    console.log('✅ Anonymous auth successful:', result.user.uid)
  } catch (error) {
    console.error('❌ Auth error:', error)
    alert('Authentication failed. Please refresh the page.')
  }

  try {
    console.log('🎲 Loading active game...')
    game.value = await getActiveGame()

    if (!game.value) {
      console.log('❌ No active game found')
      alert('No active game found')
      router.push('/')
      return
    }

    console.log('✅ Active game loaded:', game.value.id)

    // Update user's currentGameId
    console.log('📝 Updating user currentGameId...')
    await updateDoc(doc(db, 'users', user.value.id), {
      currentGameId: game.value.id,
      hasJoined: true,
      lastActiveAt: serverTimestamp(),
    })
    console.log('✅ User updated')

    console.log('📤 Loading user submissions...')
    submissions.value = (await getUserSubmissions(game.value.id, user.value.id)) || {}
    console.log('✅ Submissions loaded:', Object.keys(submissions.value).length)

    setupGameListener()
    setupLiveFeedListener()

    if (game.value.status === 'active') {
      console.log('⏰ Game is active, starting countdown')
      startCountdown()
    }

    loading.value = false
    console.log('✅ Game component ready')
  } catch (error) {
    console.error('❌ Error loading game:', error)
    alert('Failed to load game: ' + error.message)
    router.push('/')
  }
})

onUnmounted(() => {
  console.log('🧹 Cleaning up game component')
  if (unsubscribeGame) unsubscribeGame()
  if (unsubscribeFeed) unsubscribeFeed()
  if (countdownInterval.value) clearInterval(countdownInterval.value)
  if (timerInterval.value) clearInterval(timerInterval.value)
})

// Watch for game status change to active
watch(
  () => game.value?.status,
  (newStatus, oldStatus) => {
    console.log(`🔄 Game status changed: ${oldStatus} → ${newStatus}`)
    if (oldStatus === 'waiting' && newStatus === 'active') {
      startCountdown()
    }
  },
)

// Game countdown
const startCountdown = () => {
  console.log('⏰ Starting countdown from 30')
  showCountdown.value = true
  countdown.value = 30

  countdownInterval.value = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      console.log('✅ Countdown finished')
      clearInterval(countdownInterval.value)
      showCountdown.value = false
    }
  }, 1000)
}

// Checking of completion of prompt
const checkCompletion = async () => {
  const submittedCount = Object.keys(submissions.value).length
  console.log(`🎯 Checking completion: ${submittedCount}/3 prompts submitted`)

  if (submittedCount === 3 && game.value?.id && user.value?.id) {
    console.log('🎉 All prompts completed!')

    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }

    // Get completion time from server
    console.log('⏱️ Fetching completion time...')
    const result = await getUserCompletionTime(game.value.id, user.value.id)

    if (result) {
      console.log('✅ Completion time:', result.formattedTime)
      completionTime.value = result
      showCompletionModal.value = true
    }
  }
}

// Snapshot of game
const setupGameListener = () => {
  if (!game.value) return
  console.log('👂 Setting up game listener')
  const q = query(collection(db, 'games'), where('isActive', '==', true))
  unsubscribeGame = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      game.value = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
      console.log('🔄 Game updated via listener')
    }
  })
}

// User live feed — current game only
const setupLiveFeedListener = () => {
  if (!game.value?.id) {
    console.log('⚠️ No game ID for live feed')
    liveFeed.value = []
    return
  }

  console.log('👂 Setting up live feed listener')
  const q = query(
    collection(db, 'users'),
    where('currentGameId', '==', game.value.id),
    where('hasJoined', '==', true),
    orderBy('joinedAt', 'desc'),
  )

  unsubscribeFeed = onSnapshot(q, (snapshot) => {
    liveFeed.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      instagramHandle: doc.data().instagramHandle,
    }))
    console.log(`👥 Live feed updated: ${liveFeed.value.length} users`)
  })
}

// Index of the next prompt user should upload
const nextPromptIndex = computed(() => {
  if (!game.value || !submissions.value) return 0
  for (let i = 0; i < game.value.prompts.length; i++) {
    if (!submissions.value[i]) return i
  }
  return null
})

// Handling photo select with validation
const handlePhotoSelect = (promptIndex, e) => {
  const file = e.target.files[0]

  console.log('📸 Photo selected:', {
    promptIndex,
    fileName: file?.name,
    fileSize: file ? `${(file.size / 1024 / 1024).toFixed(2)}MB` : 'N/A',
    fileType: file?.type,
  })

  if (!file) {
    console.log('❌ No file selected')
    return
  }

  // Validate file type
  const validTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
  ]
  if (!validTypes.includes(file.type.toLowerCase())) {
    console.error('❌ Invalid file type:', file.type)
    alert(`Invalid file type: ${file.type}\nPlease select a JPEG, PNG, or WEBP image.`)
    e.target.value = '' // Reset input
    return
  }

  // Validate file size (max 20MB before compression)
  const maxSize = 20 * 1024 * 1024 // 20MB
  if (file.size > maxSize) {
    console.error('❌ File too large:', file.size)
    alert(
      `File is too large (${(file.size / 1024 / 1024).toFixed(2)}MB)\nPlease select an image smaller than 20MB.`,
    )
    e.target.value = '' // Reset input
    return
  }

  console.log('✅ File validation passed')
  selectedPhotoFile.value = file
  handlePhotoUpload(promptIndex)
}

// Handling photo upload with detailed error logging
const handlePhotoUpload = async (promptIndex, retryCount = 0) => {
  if (!selectedPhotoFile.value) {
    console.log('❌ No file to upload')
    return
  }

  uploadingPrompt.value = promptIndex

  console.log(`📤 Starting upload attempt ${retryCount + 1}:`, {
    promptIndex,
    gameId: game.value?.id,
    userId: user.value?.id,
    fileName: selectedPhotoFile.value.name,
  })

  try {
    // Ensure auth before upload
    const { auth } = await import('/firebase/config')
    if (!auth.currentUser) {
      console.log('⚠️ No auth user detected, signing in anonymously...')
      const { signInAnonymously } = await import('firebase/auth')
      await signInAnonymously(auth)
      console.log('✅ Anonymous sign-in successful')
    } else {
      console.log('✅ User already authenticated:', auth.currentUser.uid)
    }

    const url = await submitPhoto(
      game.value.id,
      user.value.id,
      user.value.instagramHandle,
      promptIndex,
      selectedPhotoFile.value,
    )

    console.log('✅ Upload successful! URL:', url)

    // Refresh submissions from server
    console.log('🔄 Refreshing submissions...')
    submissions.value = await getUserSubmissions(game.value.id, user.value.id)
    console.log('✅ Submissions refreshed:', Object.keys(submissions.value).length, 'total')

    selectedPhotoFile.value = null

    // Check if all prompts completed
    await checkCompletion()
  } catch (error) {
    console.error('❌ UPLOAD ERROR DETAILS:', {
      message: error.message,
      code: error.code,
      name: error.name,
      stack: error.stack,
      fullError: error,
    })

    // Retry logic for network/timeout errors
    const maxRetries = 2
    const retryableErrors = [
      'network',
      'timeout',
      'failed to fetch',
      'retry-limit-exceeded',
      'connection',
      'fetch',
    ]

    const isRetryable = retryableErrors.some(
      (keyword) =>
        error.message?.toLowerCase().includes(keyword) ||
        error.code?.toLowerCase().includes(keyword),
    )

    if (retryCount < maxRetries && isRetryable) {
      console.log(`🔄 Retrying upload (${retryCount + 1}/${maxRetries})...`)

      // Exponential backoff
      const delay = 1000 * Math.pow(2, retryCount)
      console.log(`⏳ Waiting ${delay}ms before retry...`)

      await new Promise((resolve) => setTimeout(resolve, delay))

      return handlePhotoUpload(promptIndex, retryCount + 1)
    }

    // Determine user-friendly error message
    let errorMessage = 'Upload failed. Please try again.'
    let technicalDetails = `Error: ${error.message || 'Unknown'}`

    if (error.code === 'storage/unauthorized' || error.message?.includes('unauthorized')) {
      errorMessage =
        '🔐 Authentication Error\n\nYour session may have expired.\nPlease refresh the page and try again.'
      technicalDetails = 'Error: storage/unauthorized - User not authenticated'
    } else if (error.code === 'storage/quota-exceeded') {
      errorMessage =
        '💾 Storage Limit Reached\n\nThe storage quota has been exceeded.\nPlease contact support.'
      technicalDetails = 'Error: storage/quota-exceeded'
    } else if (
      error.code === 'storage/retry-limit-exceeded' ||
      error.message?.includes('timeout')
    ) {
      errorMessage =
        '⏱️ Upload Timeout\n\nThe upload took too long.\nPlease check your internet connection and try again.'
      technicalDetails = 'Error: timeout or retry limit exceeded'
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = '📡 Network Error\n\nPlease check your internet connection and try again.'
      technicalDetails = `Error: ${error.message}`
    } else if (error.code === 'storage/object-not-found') {
      errorMessage = '📁 Upload Error\n\nStorage location not found.\nPlease contact support.'
      technicalDetails = 'Error: storage/object-not-found'
    } else if (error.message?.includes('compression')) {
      errorMessage =
        '🖼️ Image Processing Error\n\nFailed to process the image.\nTry a different photo or smaller file size.'
      technicalDetails = `Error: ${error.message}`
    } else {
      errorMessage = `❌ Upload Failed\n\n${error.message || 'Unknown error occurred'}\n\nPlease try again or contact support if this persists.`
      technicalDetails = `Error: ${error.code || error.name || 'Unknown'} - ${error.message}`
    }

    console.error('🚨 SHOWING ERROR TO USER:', {
      userMessage: errorMessage,
      technical: technicalDetails,
    })

    alert(errorMessage)

    // Don't reset file on retryable errors in case user wants to retry manually
    if (!isRetryable || retryCount >= maxRetries) {
      selectedPhotoFile.value = null
    }
  } finally {
    uploadingPrompt.value = null
    console.log('✅ Upload attempt finished')
  }
}

// Logout session
const handleLogout = () => {
  console.log('👋 Logging out user')
  localStorage.removeItem('bmg_user')
  router.push('/')
}
</script>

<template>
  <main class="main min-h-screen bg-soft font-montserrat">
    <NavigationGame @open-exit-modal="showExitGameModal = true" />

    <!-- Loading state -->
    <div class="max-w-4xl mx-auto px-4 py-8">
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <svg
            class="w-12 h-12 text-primary mx-auto mb-3 animate-spin"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <p class="text-slate">Loading game...</p>
        </div>
      </div>

      <!-- Countdown state -->
      <CountdownOverlay
        v-else-if="showCountdown && game?.status === 'active'"
        :countdown="countdown"
      />

      <!-- Waiting state -->
      <div
        v-else-if="game?.status === 'waiting' || game?.status === 'starting'"
        class="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div class="grid gap-6 lg:col-span-2">
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 class="text-2xl font-bold text-dark-gray mb-2">
              Welcome, {{ user?.instagramHandle }}!
            </h2>
            <div class="bg-primary/10 border-2 border-primary rounded-lg p-6 my-6">
              <div class="flex items-center justify-center gap-3 mb-3">
                <svg
                  class="w-6 h-6 text-primary animate-pulse"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span class="text-lg font-semibold text-primary">Waiting for game to start</span>
              </div>
              <div class="flex items-center justify-center gap-1">
                <div
                  class="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style="animation-delay: 0s"
                ></div>
                <div
                  class="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style="animation-delay: 0.1s"
                ></div>
                <div
                  class="w-2 h-2 bg-primary rounded-full animate-bounce"
                  style="animation-delay: 0.2s"
                ></div>
              </div>
            </div>
            <p class="text-slate text-sm mb-6">
              The admin will start the game soon. Once the game starts, you'll see prompts and can
              upload your photos!
            </p>
          </div>
          <!-- Prize -->
          <div v-if="game?.prize" class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-semibold text-dark-gray mb-4 text-center">Today's Prize</h3>
            <div class="flex flex-col items-center gap-4">
              <div
                v-if="game.prize.logoUrl"
                class="w-32 h-32 rounded-full overflow-hidden shadow-lg"
              >
                <img
                  :src="game.prize.logoUrl"
                  alt="Prize logo"
                  class="w-full h-full object-cover"
                />
              </div>
              <p class="text-center text-dark-gray font-medium max-w-md">
                {{ game.prize.description || 'Amazing prize awaits the fastest player!' }}
              </p>
            </div>
          </div>
        </div>

        <div class="lg:col-span-1" v-if="game?.status === 'waiting' || game?.status === 'starting'">
          <LiveFeed :live-feed="liveFeed" />
        </div>
      </div>

      <!-- Active game -->
      <ActiveActualGame
        v-else-if="game?.status === 'active' && !showCountdown"
        :game="game"
        :user="user"
        :submissions="submissions"
        :next-prompt-index="nextPromptIndex"
        :uploading-prompt="uploadingPrompt"
        @photo-select="handlePhotoSelect"
      />

      <!-- End game -->
      <GameEnded v-else-if="game?.status === 'ended'" @logout="handleLogout" />
    </div>

    <!-- Exit game modal -->
    <ExitGameModal
      v-model="showExitGameModal"
      :is-logging-out="isLoggingOut"
      @confirm="handleLogout"
    />

    <!-- Final completion -->
    <CompletionModal
      v-model="showCompletionModal"
      :completion-time="completionTime"
      :is-logging-out="isLoggingOut"
      @exit="handleLogout"
    />
  </main>
</template>

<style>
.main {
  background-image: radial-gradient(circle, hsl(270 50% 88%) 0.125rem, transparent 0.125rem);
  background-size: 1.25rem 1.25rem;
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
