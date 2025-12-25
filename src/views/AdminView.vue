<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { auth } from '/firebase/config'
import { useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'

import { getActiveGame, listenToSubmissions } from '/firebase/gameHelpers' // ← Change: listenToSubmissions only

import BMGLogo from '/BMG-Logo.png'

import CreateGameForm from '../components/admin/CreateGameForm.vue'
import GameStatus from '../components/admin/GameStatus.vue'
import Leaderboard from '../components/admin/Leaderboard.vue'
import PrizeEditorForm from '../components/admin/PrizeEditorForm.vue'
import SubmissionsGallery from '../components/admin/SubmissionsGallery.vue'

const router = useRouter()

// ===============================================
// SHARED STATE
// ===============================================
const currentGame = ref(null)
const allSubmissions = ref([])
const leaderboard = ref([])
const users = ref(['All Users'])
const selectedUser = ref('All Users')
const loadingGame = ref(false)

const showLogoutModal = ref(false)
const isLoggingOut = ref(false)

let unsubscribeSubs = null

// ===============================================
// LIFECYCLE
// ===============================================
onMounted(() => {
  loadGameData()
})

onUnmounted(() => {
  if (unsubscribeSubs) unsubscribeSubs()
})

// ===============================================
// LOAD ACTIVE GAME & SETUP REAL-TIME LISTENER
// ===============================================
const loadGameData = async () => {
  try {
    loadingGame.value = true
    currentGame.value = await getActiveGame()

    selectedUser.value = 'All Users'

    if (currentGame.value) {
      setupCurrentGameListener()
    } else {
      // No active game
      allSubmissions.value = []
      users.value = ['All Users']
      leaderboard.value = []
    }
  } catch (error) {
    console.error('Error loading game:', error)
  } finally {
    loadingGame.value = false
  }
}

const setupCurrentGameListener = () => {
  if (unsubscribeSubs) unsubscribeSubs()

  if (!currentGame.value?.id) {
    allSubmissions.value = []
    return
  }

  unsubscribeSubs = listenToSubmissions(currentGame.value.id, (subs) => {
    allSubmissions.value = subs
    updateLeaderboard()
    updateUsersList(subs)
  })
}

// Watch for game change (e.g., after creating new game)
watch(
  () => currentGame.value?.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      setupCurrentGameListener()
    }
  },
)

// ===============================================
// UPDATE USERS DROPDOWN
// ===============================================
const updateUsersList = (subs) => {
  const handleSet = new Set(['All Users'])

  subs.forEach((sub) => {
    if (sub.instagramHandle) {
      handleSet.add(sub.instagramHandle)
    }
  })

  users.value = Array.from(handleSet).sort((a, b) => {
    if (a === 'All Users') return -1
    if (b === 'All Users') return 1
    return a.localeCompare(b)
  })
}

// ===============================================
// LEADERBOARD
// ===============================================
const updateLeaderboard = () => {
  if (allSubmissions.value.length === 0) {
    leaderboard.value = []
    return
  }

  const userBestTimes = {}
  allSubmissions.value.forEach((sub) => {
    const { userId, instagramHandle, uploadedAt, promptIndex } = sub
    if (!userId || !uploadedAt) return

    if (!userBestTimes[userId]) {
      userBestTimes[userId] = { instagramHandle, times: [], prompts: new Set() }
    }

    const timeMs = uploadedAt.toMillis()
    userBestTimes[userId].times.push(timeMs)
    userBestTimes[userId].prompts.add(promptIndex)
  })

  const entries = []
  Object.entries(userBestTimes).forEach(([userId, info]) => {
    if (info.prompts.size === 3) {
      const start = Math.min(...info.times)
      const end = Math.max(...info.times)
      const total = end - start
      entries.push({
        userId,
        instagramHandle: info.instagramHandle,
        totalTime: total,
        formattedTime: formatDetailedTime(total),
      })
    }
  })

  leaderboard.value = entries
    .sort((a, b) => a.totalTime - b.totalTime)
    .slice(0, 10)
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

const formatDetailedTime = (ms) => {
  if (ms <= 0) return '0s 0ms'
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const millis = ms % 1000
  const minPart = minutes > 0 ? `${minutes}m ` : ''
  const secPart = `${seconds}s `
  const msPart = `${millis.toString().padStart(3, '0')}ms`
  return `${minPart}${secPart}${msPart}`.trim()
}

// Watch submissions for leaderboard update
watch(allSubmissions, updateLeaderboard, { deep: true })

// ===============================================
// LOGOUT
// ===============================================
const confirmLogout = async () => {
  isLoggingOut.value = true
  try {
    await signOut(auth)
    router.push('/')
  } catch (error) {
    console.error('Logout error:', error)
  } finally {
    isLoggingOut.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-soft font-montserrat">
    <header class="bg-white shadow-xl px-4 py-4 sticky top-0 z-20">
      <div class="flex justify-between items-center w-full max-w-6xl mx-auto">
        <img :src="BMGLogo" class="w-24 h-12" alt="Bring Me Game Logo" />
        <button
          @click="showLogoutModal = true"
          class="flex items-center gap-1 text-dark-gray transition cursor-pointer hover:text-primary"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
            />
          </svg>
          Sign Out
        </button>
      </div>
    </header>

    <!-- Main content -->
    <main class="max-w-6xl mx-auto px-4 py-8">
      <h1 class="text-3xl font-bold text-dark-gray mb-8">Admin Panel</h1>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Left Column -->
        <div class="space-y-6">
          <CreateGameForm
            :current-game="currentGame"
            :loading-game="loadingGame"
            @game-created="loadGameData"
          />

          <GameStatus :current-game="currentGame" />

          <Leaderboard :leaderboard="leaderboard" />

          <PrizeEditorForm :current-game="currentGame" @prize-saved="loadGameData" />
        </div>

        <!-- Right column -->
        <SubmissionsGallery
          :current-game="currentGame"
          :all-submissions="allSubmissions"
          :users="users"
          v-model:selected-user="selectedUser"
        />
      </div>
    </main>

    <!-- Logout modal -->
    <Transition name="fade">
      <div
        v-if="showLogoutModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
        @click.self="showLogoutModal = false"
      >
        <div class="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full">
          <h3 class="text-lg font-semibold text-dark-gray mb-2">Confirm Sign Out</h3>
          <p class="text-sm text-slate mb-6">Are you sure you'd like to sign out?</p>
          <div class="flex gap-3 justify-end">
            <button
              @click="showLogoutModal = false"
              class="px-4 py-2 text-sm font-medium text-dark-gray bg-soft rounded-md cursor-pointer hover:bg-light"
            >
              Cancel
            </button>
            <button
              @click="confirmLogout"
              :disabled="isLoggingOut"
              class="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary disabled:opacity-50 cursor-pointer hover:bg-primary/90"
            >
              {{ isLoggingOut ? 'Signing out...' : 'Sign Out' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
