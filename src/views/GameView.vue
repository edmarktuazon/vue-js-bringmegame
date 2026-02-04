<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  getActiveGame,
  getUserSubmissions,
  submitPhoto,
  getUserCompletionTime,
} from '/firebase/gameHelpers'
import { db } from '/firebase/config'
import {
  doc,
  updateDoc,
  serverTimestamp,
  onSnapshot,
  query,
  collection,
  where,
  orderBy,
} from 'firebase/firestore'

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
const localPreviews = ref({})
const liveFeed = ref([])
const showExitGameModal = ref(false)
const isLoggingOut = ref(false)
const showCountdown = ref(false)
const countdown = ref(30)
const countdownInterval = ref(null)
const showCompletionModal = ref(false)
const completionTime = ref(null)

let unsubscribeGame = null
let unsubscribeFeed = null
let unsubscribeSubmissions = null

onMounted(async () => {
  const userStr = localStorage.getItem('bmg_user')
  if (!userStr) {
    router.push('/')
    return
  }
  user.value = JSON.parse(userStr)

  try {
    game.value = await getActiveGame()
    if (!game.value) {
      router.push('/')
      return
    }

    await updateDoc(doc(db, 'users', user.value.id), {
      currentGameId: game.value.id,
      hasJoined: true,
      lastActiveAt: serverTimestamp(),
    })

    submissions.value = (await getUserSubmissions(game.value.id, user.value.id)) || {}

    setupListeners()

    if (game.value.status === 'active') {
      const startedMs = game.value.startedAt?.toMillis() || 0
      const elapsed = Date.now() - startedMs
      if (elapsed < 30000) {
        startCountdown(30 - Math.floor(elapsed / 1000))
      }
    }

    loading.value = false
  } catch (err) {
    console.error('Error sa game loading:', err)
    router.push('/')
  }
})

const setupListeners = () => {
  unsubscribeGame = onSnapshot(
    query(collection(db, 'games'), where('isActive', '==', true)),
    (snap) => {
      if (!snap.empty) {
        game.value = { id: snap.docs[0].id, ...snap.docs[0].data() }
      }
    },
  )

  unsubscribeFeed = onSnapshot(
    query(
      collection(db, 'users'),
      where('currentGameId', '==', game.value?.id),
      where('hasJoined', '==', true),
      orderBy('joinedAt', 'desc'),
    ),
    (snap) => {
      liveFeed.value = snap.docs.map((d) => ({
        id: d.id,
        instagramHandle: d.data().instagramHandle,
      }))
    },
  )

  if (game.value?.id && user.value?.id) {
    unsubscribeSubmissions = onSnapshot(
      query(
        collection(db, 'games', game.value.id, 'submissions'),
        where('userId', '==', user.value.id),
      ),
      async (snap) => {
        const freshSubs = {}
        snap.forEach((doc) => {
          const data = doc.data()
          freshSubs[data.promptIndex] = data
        })
        submissions.value = freshSubs
        await checkCompletion()
      },
    )
  }
}

const startCountdown = (initial = 30) => {
  showCountdown.value = true
  countdown.value = initial

  countdownInterval.value = setInterval(() => {
    countdown.value--
    if (countdown.value <= 0) {
      clearInterval(countdownInterval.value)
      showCountdown.value = false
    }
  }, 1000)
}

watch(
  () => game.value?.status,
  (newVal, oldVal) => {
    if (newVal === 'active' && oldVal !== 'active') {
      startCountdown()
    }
  },
)

const nextPromptIndex = computed(() => {
  if (!game.value?.prompts) return 0
  for (let i = 0; i < game.value.prompts.length; i++) {
    if (!submissions.value[i]) return i
  }
  return null
})

const checkCompletion = async () => {
  if (Object.keys(submissions.value).length === 3 && game.value?.id && user.value?.id) {
    const result = await getUserCompletionTime(game.value.id, user.value.id)
    if (result?.totalTime > 0) {
      completionTime.value = result
      showCompletionModal.value = true
    }
  }
}

const handlePhotoSelect = async (promptIndex, event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const compressedFile = await compressImage(file, {
      maxWidth: 1024,
      maxHeight: 1024,
      quality: 0.7,
    })

    const previewUrl = URL.createObjectURL(compressedFile)
    localPreviews.value[promptIndex] = previewUrl

    submissions.value = {
      ...submissions.value,
      [promptIndex]: {
        status: 'uploading',
        promptIndex,
        preview: previewUrl,
      },
    }

    submitPhoto(
      game.value.id,
      user.value.id,
      user.value.instagramHandle,
      promptIndex,
      compressedFile,
    )
      .then(async () => {
        submissions.value = (await getUserSubmissions(game.value.id, user.value.id)) || {}
        await checkCompletion()
      })
      .catch((err) => {
        console.error('Upload failed:', err)
        alert('Error uploading photo. Please try again.')
        delete submissions.value[promptIndex]
      })
      .finally(() => {
        URL.revokeObjectURL(previewUrl)
        delete localPreviews.value[promptIndex]
      })
  } catch (err) {
    console.error('Image processing failed:', err)
    alert('Error processing photo. Please try a smaller file.')
  }
}

const handleLogout = () => {
  localStorage.removeItem('bmg_user')
  router.push('/')
}

onUnmounted(() => {
  if (unsubscribeGame) unsubscribeGame()
  if (unsubscribeFeed) unsubscribeFeed()
  if (unsubscribeSubmissions) unsubscribeSubmissions()
  if (countdownInterval.value) clearInterval(countdownInterval.value)
  Object.values(localPreviews.value).forEach(URL.revokeObjectURL)
})

const compressImage = (file, options = {}) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.src = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      let width = img.width
      let height = img.height

      if (width > options.maxWidth) {
        height = Math.round((options.maxWidth / width) * height)
        width = options.maxWidth
      }
      if (height > options.maxHeight) {
        width = Math.round((options.maxHeight / height) * width)
        height = options.maxHeight
      }

      canvas.width = width
      canvas.height = height
      ctx.drawImage(img, 0, 0, width, height)

      canvas.toBlob(
        (blob) => {
          if (!blob) return reject(new Error('Compression failed'))
          const compressedFile = new File([blob], file.name, {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
          resolve(compressedFile)
        },
        'image/jpeg',
        options.quality || 0.7,
      )
    }

    img.onerror = () => reject(new Error('Failed to load image'))
  })
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
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p class="text-slate">Loading game...</p>
        </div>
      </div>

      <!-- Countdown -->
      <CountdownOverlay
        v-else-if="showCountdown && game?.status === 'active'"
        :countdown="countdown"
      />

      <!-- Waiting Room -->
      <div
        v-else-if="game?.status === 'waiting' || game?.status === 'starting'"
        class="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div class="grid gap-6 lg:col-span-2">
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 class="text-2xl font-bold text-dark-gray mb-2">
              Welcome, <span class="text-primary">{{ user?.instagramHandle }}</span
              >!
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

      <!-- Active Game -->
      <ActiveActualGame
        v-else-if="game?.status === 'active' && !showCountdown"
        :game="game"
        :user="user"
        :submissions="submissions"
        :next-prompt-index="nextPromptIndex"
        :uploading-prompt="null"
        @photo-select="handlePhotoSelect"
      />

      <!-- Game Ended -->
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
