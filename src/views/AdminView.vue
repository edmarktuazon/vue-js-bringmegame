<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { auth } from '/firebase/config'
import { useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import { db } from '/firebase/config'
import { doc, onSnapshot, collection, query, where, orderBy, updateDoc } from 'firebase/firestore'

import { getActiveGame, listenToSubmissions } from '/firebase/gameHelpers'

import BMGLogo from '/BMG-Logo.png'

import CreateGameForm from '../components/admin/CreateGameForm.vue'
import GameStatus from '../components/admin/GameStatus.vue'
import Leaderboard from '../components/admin/Leaderboard.vue'
import PrizeEditorForm from '../components/admin/PrizeEditorForm.vue'
import SubmissionsGallery from '../components/admin/SubmissionsGallery.vue'
import {
  listenToNotifySubscribers,
  deleteNotifySubscriber,
  deleteAllNotifySubscribers,
  formatAEST,
  melbourneInputToUTCMillis,
  utcMillisToMelbourneInput,
} from '/firebase/notifySubscribers'

const router = useRouter()

// nofify subscribers
const notifySubscribers = ref([])
const isClearingSubs = ref(false)
const deletingSubId = ref(null)
let unsubscribeNotify = null

// Shared states
const currentGame = ref(null)
const allSubmissions = ref([])
const leaderboard = ref([])
const liveLeaderboard = ref([])
const users = ref(['All Users'])
const selectedUser = ref('All Users')
const loadingGame = ref(false)
const liveFeed = ref([])
const showLogoutModal = ref(false)
const isLoggingOut = ref(false)

// Next game countdown
const nextGameDateTime = ref('')
const isSavingNextGame = ref(false)

let unsubscribeSubs = null
let unsubscribeGame = null
let unsubscribeLiveFeed = null

onMounted(() => {
  loadGameData()
})

onUnmounted(() => {
  if (unsubscribeSubs) unsubscribeSubs()
  if (unsubscribeGame) unsubscribeGame()
  if (unsubscribeLiveFeed) unsubscribeLiveFeed()
  if (unsubscribeNotify) unsubscribeNotify()
})

const loadGameData = async () => {
  try {
    loadingGame.value = true
    currentGame.value = await getActiveGame()
    selectedUser.value = 'All Users'

    if (currentGame.value) {
      setupCurrentGameListener()
      setupLiveFeedListener()
      setupNotifyListener()

      // Load existing nextGameStartTime
      const nextStart = currentGame.value.nextGameStartTime
      if (nextStart) {
        const ms = typeof nextStart === 'number' ? nextStart : nextStart?.toMillis?.() || 0
        if (ms) {
          nextGameDateTime.value = utcMillisToMelbourneInput(ms)
        }
      }
    } else {
      allSubmissions.value = []
      users.value = ['All Users']
      leaderboard.value = []
      liveLeaderboard.value = []
      liveFeed.value = []
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
    updateLiveLeaderboard()
    updateUsersList(subs)
  })

  if (unsubscribeGame) unsubscribeGame()
  unsubscribeGame = onSnapshot(doc(db, 'games', currentGame.value.id), (snap) => {
    if (snap.exists()) {
      currentGame.value = { id: snap.id, ...snap.data() }
    }
  })
}

const setupNotifyListener = () => {
  if (unsubscribeNotify) unsubscribeNotify()
  if (!currentGame.value?.id) {
    notifySubscribers.value = []
    return
  }
  unsubscribeNotify = listenToNotifySubscribers(currentGame.value.id, (subs) => {
    notifySubscribers.value = subs
  })
}

const setupLiveFeedListener = () => {
  if (unsubscribeLiveFeed) unsubscribeLiveFeed()
  if (!currentGame.value?.id) {
    liveFeed.value = []
    return
  }

  const q = query(
    collection(db, 'users'),
    where('currentGameId', '==', currentGame.value.id),
    where('hasJoined', '==', true),
    orderBy('joinedAt', 'desc'),
  )

  unsubscribeLiveFeed = onSnapshot(q, (snapshot) => {
    liveFeed.value = snapshot.docs.map((doc) => ({
      id: doc.id,
      instagramHandle: doc.data().instagramHandle,
    }))
  })
}

watch(
  () => currentGame.value?.id,
  (newId, oldId) => {
    if (newId !== oldId) {
      setupCurrentGameListener()
      setupLiveFeedListener()
    }
  },
)

const updateUsersList = (subs) => {
  const handleSet = new Set(['All Users'])
  subs.forEach((sub) => {
    if (sub.instagramHandle) handleSet.add(sub.instagramHandle)
  })
  users.value = Array.from(handleSet).sort((a, b) => {
    if (a === 'All Users') return -1
    if (b === 'All Users') return 1
    return a.localeCompare(b)
  })
}

const updateLeaderboard = () => {
  if (allSubmissions.value.length === 0) {
    leaderboard.value = []
    return
  }

  const gameStartTime = currentGame.value?.startedAt?.toMillis() + 30000
  if (!currentGame.value?.startedAt) {
    leaderboard.value = []
    return
  }

  const userBestTimes = {}
  allSubmissions.value.forEach((sub) => {
    const { userId, instagramHandle, uploadedAt, promptIndex, status } = sub
    if (!userId || !uploadedAt) return

    if (!userBestTimes[userId]) {
      userBestTimes[userId] = {
        instagramHandle,
        times: [],
        prompts: new Set(),
        isDisqualified: false,
      }
    }

    const timeMs = uploadedAt.toMillis()
    userBestTimes[userId].times.push(timeMs)
    userBestTimes[userId].prompts.add(promptIndex)

    if (status === 'disqualified') {
      userBestTimes[userId].isDisqualified = true
    }
  })

  const entries = []
  Object.entries(userBestTimes).forEach(([userId, info]) => {
    if (info.prompts.size === 3) {
      if (info.isDisqualified) {
        entries.push({
          userId,
          instagramHandle: info.instagramHandle,
          totalTime: Infinity,
          formattedTime: 'DQ',
          isDisqualified: true,
        })
        return
      }

      const completedAt = Math.max(...info.times)
      let totalTime = completedAt - gameStartTime
      if (totalTime < 0) totalTime = 0
      entries.push({
        userId,
        instagramHandle: info.instagramHandle,
        totalTime,
        formattedTime: formatDetailedTime(totalTime),
        isDisqualified: false,
      })
    }
  })

  leaderboard.value = entries
    .sort((a, b) => {
      if (a.isDisqualified && !b.isDisqualified) return 1
      if (!a.isDisqualified && b.isDisqualified) return -1
      return a.totalTime - b.totalTime
    })
    .map((e, i) => ({ ...e, rank: i + 1 }))
}

const updateLiveLeaderboard = () => {
  if (allSubmissions.value.length === 0) {
    liveLeaderboard.value = []
    return
  }

  const userMap = new Map()
  allSubmissions.value.forEach((sub) => {
    const { userId, instagramHandle, status, uploadedAt } = sub
    if (!userId) return

    if (!userMap.has(userId)) {
      userMap.set(userId, {
        handle: instagramHandle || 'unknown',
        approvedCount: 0,
        lastTime: 0,
        count: 0,
        isDisqualified: false,
      })
    }

    const u = userMap.get(userId)
    u.count++
    if (uploadedAt?.toMillis() > u.lastTime) u.lastTime = uploadedAt.toMillis()
    if (status === 'approved') u.approvedCount++
    if (status === 'disqualified') u.isDisqualified = true
  })

  const list = []
  userMap.forEach((u, id) => {
    if (u.count !== 3) return
    if (u.isDisqualified) {
      list.push({ id, handle: u.handle, approvedCount: 0, timeMs: Infinity, isDisqualified: true })
      return
    }
    list.push({
      id,
      handle: u.handle,
      approvedCount: u.approvedCount,
      timeMs: u.lastTime,
      isDisqualified: false,
    })
  })

  list.sort((a, b) => {
    if (a.isDisqualified && !b.isDisqualified) return 1
    if (!a.isDisqualified && b.isDisqualified) return -1
    if (b.approvedCount !== a.approvedCount) return b.approvedCount - a.approvedCount
    return a.timeMs - b.timeMs
  })

  liveLeaderboard.value = list.map((item, i) => ({ ...item, rank: i + 1 }))
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

watch(
  allSubmissions,
  () => {
    updateLeaderboard()
    updateLiveLeaderboard()
  },
  { deep: true },
)

// Save next game countdown
const handleSaveNextGameTime = async () => {
  if (!nextGameDateTime.value || !currentGame.value?.id) return
  isSavingNextGame.value = true
  try {
    const targetMs = melbourneInputToUTCMillis(nextGameDateTime.value)
    await updateDoc(doc(db, 'games', currentGame.value.id), {
      nextGameStartTime: targetMs,
    })
    alert('Next game time saved (AEST — Melbourne, VIC)! Countdown will show on the home page.')
  } catch (error) {
    alert('Failed to save: ' + error.message)
  } finally {
    isSavingNextGame.value = false
  }
}

const handleDeleteSubscriber = async (subId) => {
  deletingSubId.value = subId
  const result = await deleteNotifySubscriber(subId)
  deletingSubId.value = null
  if (!result.success) {
    alert('Failed to delete: ' + result.error)
  }
}

const handleClearAllSubscribers = async () => {
  if (!currentGame.value?.id) return
  if (!confirm('Delete all entries in this table? This cannot be undone.')) return

  isClearingSubs.value = true
  const result = await deleteAllNotifySubscribers(currentGame.value.id)
  isClearingSubs.value = false

  if (!result.success) {
    alert('Failed to clear: ' + result.error)
  }
}

const handleClearNextGameTime = async () => {
  if (!currentGame.value?.id) return

  if (
    !confirm('Clear the countdown? The home page will immediately switch to the Join Game form.')
  ) {
    return
  }

  try {
    await updateDoc(doc(db, 'games', currentGame.value.id), {
      nextGameStartTime: null,
    })
    nextGameDateTime.value = ''
    alert('Countdown cleared.')
  } catch (error) {
    alert('Failed: ' + error.message)
  }
}

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

    <main class="max-w-6xl mx-auto px-4 py-8">
      <div class="mb-6">
        <SubmissionsGallery
          :current-game="currentGame"
          :all-submissions="allSubmissions"
          :users="users"
          v-model:selected-user="selectedUser"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Left Column -->
        <div class="space-y-6 row-end-3 md:row-end-auto">
          <GameStatus :current-game="currentGame" />

          <!-- Next Game Countdown -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Next Game Countdown</h2>
            </div>
            <p class="text-xs text-slate mb-4">
              Set the next game start time, a countdown will show on the home page.
            </p>
            <input
              v-model="nextGameDateTime"
              type="datetime-local"
              class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary mb-3"
            />
            <div class="flex gap-2">
              <button
                @click="handleSaveNextGameTime"
                :disabled="isSavingNextGame || !nextGameDateTime"
                class="w-full py-3 rounded-md font-semibold text-white transition cursor-pointer disabled:opacity-50 bg-primary hover:bg-primary/90"
              >
                {{ isSavingNextGame ? 'Saving...' : 'Set Countdown' }}
              </button>
              <button
                @click="handleClearNextGameTime"
                class="px-4 bg-gray-200 text-dark-gray py-2 rounded-md text-sm font-semibold hover:bg-gray-300 transition cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <!-- Show All Users (Notify Subscribers) -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center justify-between mb-2">
              <div class="flex items-center gap-2">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                <h2 class="text-lg font-semibold text-dark-gray">Show All Users</h2>
              </div>
              <button
                v-if="notifySubscribers.length > 0"
                @click="handleClearAllSubscribers"
                :disabled="isClearingSubs"
                class="text-xs font-medium text-red-500 hover:text-red-600 cursor-pointer disabled:opacity-50"
              >
                {{ isClearingSubs ? 'Clearing...' : 'Clear All' }}
              </button>
            </div>
            <p class="text-xs text-slate mb-4">
              Instagram handles that entered to be notified for this game (AEST — Melbourne, VIC).
            </p>

            <div v-if="notifySubscribers.length === 0" class="text-center text-slate py-8 text-sm">
              No users have entered their handle yet.
            </div>
            <div v-else class="overflow-x-auto max-h-96 overflow-y-auto">
              <table class="w-full text-sm">
                <thead class="sticky top-0 bg-white">
                  <tr class="text-left text-xs text-slate uppercase border-b border-gray-200">
                    <th class="py-2 pr-2">Instagram Handle</th>
                    <th class="py-2 pr-2">Date</th>
                    <th class="py-2 pr-2">Time</th>
                    <th class="py-2 text-right"></th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    v-for="sub in notifySubscribers"
                    :key="sub.id"
                    class="border-b border-gray-100 last:border-0"
                  >
                    <td class="py-2 pr-2 font-medium text-dark-gray">{{ sub.instagramHandle }}</td>
                    <td class="py-2 pr-2 text-slate">{{ formatAEST(sub.createdAt).date }}</td>
                    <td class="py-2 pr-2 text-slate">{{ formatAEST(sub.createdAt).time }}</td>
                    <td class="py-2 text-right">
                      <button
                        @click="handleDeleteSubscriber(sub.id)"
                        :disabled="deletingSubId === sub.id"
                        class="text-slate hover:text-red-500 cursor-pointer disabled:opacity-50 transition"
                        title="Delete entry"
                      >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <!-- Live Players -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-4">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Players</h2>
              <span class="flex items-center gap-1 ml-1">
                <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span class="text-xs text-green-600 font-medium">Live</span>
              </span>
            </div>
            <div v-if="liveFeed.length === 0" class="text-center text-slate py-8">
              No players have joined yet.
            </div>
            <div v-else class="space-y-3 max-h-96 overflow-y-auto">
              <div
                v-for="player in liveFeed"
                :key="player.id"
                class="flex items-center gap-3 py-2 px-3 bg-soft rounded-md"
              >
                <div
                  class="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold"
                >
                  {{ player.instagramHandle.charAt(0).toUpperCase() }}
                </div>
                <span class="text-dark-gray font-medium">{{ player.instagramHandle }}</span>
              </div>
            </div>
          </div>

          <CreateGameForm
            :current-game="currentGame"
            :loading-game="loadingGame"
            @game-created="loadGameData"
          />
        </div>

        <!-- Right Column -->
        <div class="space-y-6">
          <Leaderboard :leaderboard="leaderboard" :live-leaderboard="liveLeaderboard" />
          <PrizeEditorForm :current-game="currentGame" @prize-saved="loadGameData" />
        </div>
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
              {{ isLoggingOut ? 'Signing out...' : 'Yes, sign out' }}
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
