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
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'

import NavigationGame from '../components/game/NavigationGame.vue'
import CountdownOverlay from '../components/game/CountdownOverlay.vue'
import LiveFeed from '../components/game/LiveFeed.vue'
import ActiveActualGame from '../components/game/ActiveActualGame.vue'
import GameEnded from '../components/game/GameEnded.vue'
import ExitGameModal from '../components/game/ExitGameModal.vue'
import CompletionModal from '../components/game/CompletionModal.vue'

const router = useRouter()

const user = ref(null)
const game = ref(null)
const submissions = ref({})
const loading = ref(true)
const uploadingPrompt = ref(null)
const selectedPhotoFile = ref(null)
const liveFeed = ref([])
const showExitGameModal = ref(false)
const isLoggingOut = ref(false)
const showCountdown = ref(false)
const countdown = ref(30)
const countdownInterval = ref(null)
const timerInterval = ref(null)
const showCompletionModal = ref(false)
const completionTime = ref(null)

let unsubscribeGame = null
let unsubscribeFeed = null

onMounted(async () => {
  const userStr = localStorage.getItem('bmg_user')
  if (!userStr) {
    router.push('/')
    return
  }

  user.value = JSON.parse(userStr)

  // CRITICAL: Sign in FIRST before doing anything else
  try {
    const { signInAnonymously } = await import('firebase/auth')
    const { auth } = await import('/firebase/config')

    console.log('🔐 Authenticating...')
    await signInAnonymously(auth)
    console.log('✅ Authentication successful, user:', auth.currentUser.uid)

    // Add small delay to ensure auth propagates
    await new Promise((resolve) => setTimeout(resolve, 500))
  } catch (error) {
    console.error('❌ Auth error:', error)
    alert('Authentication failed. Please refresh and try again.')
    return
  }

  try {
    game.value = await getActiveGame()

    if (!game.value) {
      alert('No active game found')
      router.push('/')
      return
    }

    submissions.value = (await getUserSubmissions(game.value.id, user.value.id)) || {}

    setupGameListener()
    setupLiveFeedListener()

    if (game.value.status === 'active') {
      startCountdown()
    }

    loading.value = false
  } catch (error) {
    console.error('Error loading game:', error)
    alert('Failed to load game')
    router.push('/')
  }
})

onUnmounted(() => {
  if (unsubscribeGame) unsubscribeGame()
  if (unsubscribeFeed) unsubscribeFeed()
  if (countdownInterval.value) clearInterval(countdownInterval.value)
  if (timerInterval.value) clearInterval(timerInterval.value)
})

watch(
  () => game.value?.status,
  (newStatus, oldStatus) => {
    if (oldStatus === 'waiting' && newStatus === 'active') {
      startCountdown()
    }
  },
)

const startCountdown = () => {
  showCountdown.value = true
  countdown.value = 30

  countdownInterval.value = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval.value)
      showCountdown.value = false
    }
  }, 1000)
}

const checkCompletion = async () => {
  const submittedCount = Object.keys(submissions.value).length

  if (submittedCount === 3 && game.value?.id && user.value?.id) {
    if (timerInterval.value) {
      clearInterval(timerInterval.value)
    }

    const result = await getUserCompletionTime(game.value.id, user.value.id)

    if (result) {
      completionTime.value = result
      showCompletionModal.value = true
    }
  }
}

const setupGameListener = () => {
  if (!game.value) return
  const q = query(collection(db, 'games'), where('isActive', '==', true))
  unsubscribeGame = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      game.value = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
    }
  })
}

const setupLiveFeedListener = () => {
  const q = query(
    collection(db, 'users'),
    where('hasJoined', '==', true),
    orderBy('joinedAt', 'desc'),
  )
  unsubscribeFeed = onSnapshot(q, (snapshot) => {
    liveFeed.value = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
  })
}

const nextPromptIndex = computed(() => {
  if (!game.value || !submissions.value) return 0
  for (let i = 0; i < game.value.prompts.length; i++) {
    if (!submissions.value[i]) return i
  }
  return null
})

const handlePhotoSelect = async (promptIndex, e) => {
  const file = e.target.files[0]
  if (!file) {
    console.log('❌ No file selected')
    return
  }

  console.log('📸 File selected:', {
    name: file.name,
    type: file.type,
    size: file.size,
  })

  selectedPhotoFile.value = file

  // Start upload immediately
  await handlePhotoUpload(promptIndex)

  // Reset input to allow same file selection again
  e.target.value = ''
}

const handlePhotoUpload = async (promptIndex) => {
  if (!selectedPhotoFile.value) {
    console.log('❌ No file to upload')
    return
  }

  uploadingPrompt.value = promptIndex
  console.log('🚀 Starting upload for prompt:', promptIndex)

  try {
    const url = await submitPhoto(
      game.value.id,
      user.value.id,
      user.value.instagramHandle,
      promptIndex,
      selectedPhotoFile.value,
    )
    console.log('✅ Upload complete:', url)

    // Refresh submissions
    submissions.value = await getUserSubmissions(game.value.id, user.value.id)
    console.log('✅ Submissions refreshed')

    selectedPhotoFile.value = null

    // Check completion
    await checkCompletion()
  } catch (error) {
    console.error('❌ Upload failed:', error)
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack,
    })

    let errorMessage = 'Upload failed. '

    if (error.code === 'storage/unauthorized') {
      errorMessage += 'Authentication issue. Please refresh the page and try again.'
    } else if (error.code === 'storage/canceled') {
      errorMessage += 'Upload was canceled.'
    } else if (error.code === 'storage/unknown') {
      errorMessage += 'Network error. Please check your connection.'
    } else {
      errorMessage += error.message || 'Please try again.'
    }

    alert(errorMessage)
  } finally {
    uploadingPrompt.value = null
  }
}

const handleLogout = () => {
  localStorage.removeItem('bmg_user')
  router.push('/')
}
</script>

<template>
  <main class="main min-h-screen bg-soft font-montserrat">
    <NavigationGame @open-exit-modal="showExitGameModal = true" />

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

      <CountdownOverlay
        v-else-if="showCountdown && game?.status === 'active'"
        :countdown="countdown"
      />

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

        <div class="lg:col-span-1">
          <LiveFeed :live-feed="liveFeed" />
        </div>
      </div>

      <ActiveActualGame
        v-else-if="game?.status === 'active' && !showCountdown"
        :game="game"
        :user="user"
        :submissions="submissions"
        :next-prompt-index="nextPromptIndex"
        :uploading-prompt="uploadingPrompt"
        @photo-select="handlePhotoSelect"
      />

      <GameEnded v-else-if="game?.status === 'ended'" @logout="handleLogout" />
    </div>

    <ExitGameModal
      v-model="showExitGameModal"
      :is-logging-out="isLoggingOut"
      @confirm="handleLogout"
    />

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
