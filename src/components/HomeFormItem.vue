<script setup>
import BMGLogo from '/BMG-Logo.png'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '/firebase/config'
import { createUser, getActiveGame, updateUserCurrentGame } from '/firebase/gameHelpers'
import { saveEmailSubscriber } from '/firebase/emailNotifications'

const router = useRouter()

const instagramHandle = ref('')
const loading = ref(false)
const errorMessage = ref('')
const activeGame = ref(null)
let unsubscribeGame = null

// Countdown
const countdown = ref({ hours: 0, minutes: 0, seconds: 0 })
let countdownInterval = null
const gameStartTime = ref(null)

// Be Notified
const notifyEmail = ref('')
const notifyStatus = ref('idle')
const notifyError = ref('')

const startCountdownTimer = (targetMs) => {
  if (countdownInterval) clearInterval(countdownInterval)

  countdownInterval = setInterval(() => {
    const diff = targetMs - Date.now()
    if (diff <= 0) {
      countdown.value = { hours: 0, minutes: 0, seconds: 0 }
      clearInterval(countdownInterval)
      countdownInterval = null
      gameStartTime.value = null
      return
    }
    const hours = Math.floor(diff / 3600000)
    const minutes = Math.floor((diff % 3600000) / 60000)
    const seconds = Math.floor((diff % 60000) / 1000)
    countdown.value = { hours, minutes, seconds }
  }, 1000)
}

const checkAndStartCountdown = () => {
  const nextStart = activeGame.value?.nextGameStartTime
  if (!nextStart) return

  const targetMs = typeof nextStart === 'number' ? nextStart : nextStart?.toMillis?.() || 0

  if (targetMs > Date.now()) {
    gameStartTime.value = targetMs
    startCountdownTimer(targetMs)
  } else {
    gameStartTime.value = null
    if (countdownInterval) {
      clearInterval(countdownInterval)
      countdownInterval = null
    }
  }
}

const isCountdownActive = computed(() => {
  return gameStartTime.value && gameStartTime.value > Date.now()
})

const handleBeNotified = async () => {
  notifyError.value = ''

  if (!notifyEmail.value.trim()) {
    notifyError.value = 'Please enter your email address.'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(notifyEmail.value.trim())) {
    notifyError.value = 'Please enter a valid email address.'
    return
  }

  notifyStatus.value = 'loading'

  const result = await saveEmailSubscriber(notifyEmail.value.trim())

  if (result.success) {
    notifyStatus.value = 'success'
  } else {
    notifyStatus.value = 'error'
    notifyError.value = 'Something went wrong. Please try again.'
  }
}

onMounted(async () => {
  try {
    activeGame.value = await getActiveGame()

    if (activeGame.value) {
      const gameRef = doc(db, 'games', activeGame.value.id)
      unsubscribeGame = onSnapshot(gameRef, (snap) => {
        if (snap.exists()) {
          activeGame.value = { id: snap.id, ...snap.data() }
          checkAndStartCountdown()
        } else {
          activeGame.value = null
        }
      })

      checkAndStartCountdown()
    }
  } catch (error) {
    console.error(error)
  }
})

onUnmounted(() => {
  if (unsubscribeGame) unsubscribeGame()
  if (countdownInterval) clearInterval(countdownInterval)
})

const statusLabel = (status) => {
  if (status === 'waiting') return 'OPEN'
  if (status === 'active') return 'PLAYING'
  if (status === 'ended') return 'CLOSED'
  return status.toUpperCase()
}

const handleSubmit = async (e) => {
  e.preventDefault()

  if (!instagramHandle.value.trim()) return

  let handle = instagramHandle.value.trim()
  if (!handle.startsWith('@')) {
    handle = '@' + handle
  }

  loading.value = true
  errorMessage.value = ''

  try {
    if (!activeGame.value) {
      throw new Error('No active game available')
    }

    if (activeGame.value.status === 'ended') {
      throw new Error('This game has ended. Please wait for the next game!')
    }

    const user = await createUser(handle)
    await updateUserCurrentGame(user.id, activeGame.value.id)

    localStorage.setItem(
      'bmg_user',
      JSON.stringify({
        id: user.id,
        instagramHandle: handle,
        gameId: activeGame.value.id,
      }),
    )

    router.push('/game')
  } catch (error) {
    console.error('Error joining game:', error)
    errorMessage.value = error.message || 'Failed to join game. Please try again.'
  } finally {
    loading.value = false
  }
}

const pad = (n) => String(n).padStart(2, '0')
</script>

<template>
  <main
    class="main min-h-screen flex flex-col justify-center items-center font-montserrat px-4 py-24"
  >
    <div class="relative w-full max-w-sm text-center">
      <div class="rounded-lg bg-white shadow-xl px-6 w-full">
        <!-- Logo -->
        <div class="flex items-center flex-col pt-6">
          <img :src="BMGLogo" class="w-48 mb-6" alt="Bring Me Game Logo" />
        </div>

        <!-- Countdown Timer -->
        <div v-if="isCountdownActive" class="rounded-lg bg-purple-900 px-4 py-3 mb-3">
          <p class="text-white text-xs font-semibold mb-1 uppercase tracking-wider">
            Game Starts In:
            <span class="ml-1 bg-green-400 text-white text-xs px-2 py-0.5 rounded-full">LIVE</span>
          </p>
          <div class="flex items-center justify-center gap-1 text-white">
            <div class="text-center">
              <span class="text-3xl font-bold">{{ pad(countdown.hours) }}</span>
              <p class="text-xs opacity-70">HOURS</p>
            </div>
            <span class="text-3xl font-bold mb-3">:</span>
            <div class="text-center">
              <span class="text-3xl font-bold">{{ pad(countdown.minutes) }}</span>
              <p class="text-xs opacity-70">MINUTES</p>
            </div>
            <span class="text-3xl font-bold mb-3">:</span>
            <div class="text-center">
              <span class="text-3xl font-bold">{{ pad(countdown.seconds) }}</span>
              <p class="text-xs opacity-70">SECONDS</p>
            </div>
          </div>
        </div>

        <!-- Be Notified section, only show when countdown is active -->
        <div
          v-if="isCountdownActive"
          class="rounded-lg p-4 border-2 border-dashed border-primary/40 bg-primary/5"
        >
          <p class="text-xs font-semibold text-dark-gray mb-1">
            Get notified when the game is about to start!
          </p>
          <p class="text-xs text-slate mb-3">Enter your email to receive a notification.</p>
          <div class="flex flex-col gap-2">
            <input
              v-model="notifyEmail"
              type="email"
              placeholder="your@email.com"
              class="bg-white w-full text-dark-gray font-montserrat text-sm p-2.5 rounded-md border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary transition-all"
              :disabled="notifyStatus === 'loading' || notifyStatus === 'success'"
            />
            <button
              @click="handleBeNotified"
              :disabled="notifyStatus === 'loading' || notifyStatus === 'success'"
              type="button"
              class="w-full font-semibold py-2.5 rounded-md text-sm transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              :class="{
                'bg-primary text-white hover:bg-primary/90': notifyStatus === 'idle',
                'bg-gray-400 text-white': notifyStatus === 'loading',
                'bg-green-500 text-white': notifyStatus === 'success',
                'bg-red-400 text-white hover:bg-red-500': notifyStatus === 'error',
              }"
            >
              <span v-if="notifyStatus === 'idle'">Notify Me</span>
              <span v-else-if="notifyStatus === 'loading'">Saving...</span>
              <span v-else-if="notifyStatus === 'success'">You'll be notified!</span>
              <span v-else-if="notifyStatus === 'error'">Try again</span>
            </button>
            <p v-if="notifyError" class="text-red-500 text-xs">{{ notifyError }}</p>
          </div>
        </div>

        <!-- Game Status -->
        <div class="px-6 pt-6 mb-3">
          <p v-if="activeGame" class="text-xs text-primary font-semibold mb-1">
            Game Status: {{ statusLabel(activeGame.status) }}
          </p>
          <p class="text-sm text-dark-gray">Enter your Instagram handle to join the game.</p>
        </div>

        <!-- Input + Join button -->
        <div class="flex items-center flex-col space-y-4">
          <input
            v-model="instagramHandle"
            type="text"
            class="bg-soft w-full text-dark-gray font-montserrat text-sm p-3 rounded-md outline-primary focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            placeholder="@yourhandle"
            required
            :disabled="loading"
          />

          <button
            type="submit"
            @click="handleSubmit"
            :disabled="loading"
            class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-all duration-200 hover:bg-primary/90 focus:outline focus:outline-2 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <span v-if="loading">Joining...</span>
            <span v-else>Join Game</span>
          </button>

          <p v-if="errorMessage" class="text-red-500 text-xs">{{ errorMessage }}</p>
        </div>

        <div class="mt-3 pb-6">
          <p class="text-xs text-slate">
            By clicking "Join Game", you agree that you are the owner of the given Instagram handle.
            Any prizes won will be communicated directly via Instagram.
          </p>
        </div>
      </div>

      <!-- How It Works -->
      <div class="mt-6 bg-white rounded-lg shadow-xl w-full px-6 py-6">
        <div class="flex items-center justify-center gap-2 mb-6">
          <div class="h-px bg-gray-200 flex-1"></div>
          <p class="text-xs font-bold text-dark-gray tracking-widest uppercase">How It Works</p>
          <div class="h-px bg-gray-200 flex-1"></div>
        </div>

        <div class="grid grid-cols-3 gap-4 text-center">
          <div class="flex flex-col items-center gap-2">
            <div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                class="w-7 h-7 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <p class="text-xs font-bold text-dark-gray uppercase leading-tight">
              Enter Your Handle
            </p>
          </div>

          <div class="flex flex-col items-center gap-2">
            <div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                class="w-7 h-7 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <p class="text-xs font-bold text-dark-gray uppercase leading-tight">
              Play Against Everyone
            </p>
          </div>

          <div class="flex flex-col items-center gap-2">
            <div class="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
              <svg
                class="w-7 h-7 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
            </div>
            <p class="text-xs font-bold text-dark-gray uppercase leading-tight">Win Real Prizes</p>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.main {
  background-image: radial-gradient(circle, hsl(270 50% 88%) 0.125rem, transparent 0.125rem);
  background-size: 1.25rem 1.25rem;
}
</style>
