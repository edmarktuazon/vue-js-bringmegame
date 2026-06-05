<script setup>
import leaderboardLogo from '../assets/images/leaderboard-img-logo.png'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { onSnapshot, collection, getDocs, doc } from 'firebase/firestore'
import { db } from '/firebase/config'
import { getActiveGame } from '/firebase/gameHelpers'
import { useRouter } from 'vue-router'

import GameEndModal from '../components/game/GameEndModal.vue'

const router = useRouter()

const game = ref(null)
const rankedPlayers = ref([])
const loading = ref(true)

const showExitModal = ref(false)
const isLoggingOut = ref(false)

const showRankModal = ref(false)
const userRank = ref(null)

// Photo modal
const showPhotoModal = ref(false)
const selectedPhoto = ref(null)
const selectedPromptIndex = ref(null)

const openPhotoModal = (photoUrl, promptIndex) => {
  if (!photoUrl) return
  selectedPhoto.value = photoUrl
  selectedPromptIndex.value = promptIndex
  showPhotoModal.value = true
}

const closePhotoModal = () => {
  showPhotoModal.value = false
  selectedPhoto.value = null
  selectedPromptIndex.value = null
}

const confirmExit = () => {
  isLoggingOut.value = true
  localStorage.removeItem('bmg_user')
  router.push('/')
}

const cancelExit = () => {
  showExitModal.value = false
}

let unsub = null
let unsubGame = null

onMounted(async () => {
  game.value = await getActiveGame()
  if (!game.value) return router.push('/')

  await loadData()

  unsub = onSnapshot(collection(db, 'games', game.value.id, 'submissions'), (snapshot) =>
    processSubmissions(snapshot),
  )

  setupGameListener()
  loading.value = false
})

const setupGameListener = () => {
  if (!game.value?.id) return

  unsubGame = onSnapshot(doc(db, 'games', game.value.id), (docSnap) => {
    if (docSnap.exists()) {
      game.value = { id: docSnap.id, ...docSnap.data() }

      if (game.value.status === 'ended') {
        setTimeout(() => {
          detectUserRank()
        }, 800)
      }
    }
  })
}

const loadData = async () => {
  if (!game.value?.id) return
  const snap = await getDocs(collection(db, 'games', game.value.id, 'submissions'))
  processSubmissions(snap)
}

const processSubmissions = (snap) => {
  if (!game.value?.id) return

  const userMap = new Map()
  const startMs = game.value.startTime?.toMillis ? game.value.startTime.toMillis() : 0

  snap.forEach((d) => {
    const data = d.data()
    if (!data.userId || data.promptIndex == null) return

    if (!userMap.has(data.userId)) {
      userMap.set(data.userId, {
        handle: data.instagramHandle || 'unknown',
        approvedCount: 0,
        lastTime: 0,
        statuses: [null, null, null],
        photoUrls: [null, null, null],
        count: 0,
        isDisqualified: false,
      })
    }

    const u = userMap.get(data.userId)
    u.count++
    u.statuses[data.promptIndex] = data.status
    u.photoUrls[data.promptIndex] = data.photoUrl || null

    if (data.uploadedAt?.toMillis() > u.lastTime) {
      u.lastTime = data.uploadedAt.toMillis()
    }

    if (data.status === 'approved') {
      u.approvedCount++
    }

    if (data.status === 'disqualified') {
      u.isDisqualified = true
    }
  })

  const list = []
  userMap.forEach((u, id) => {
    if (u.count !== 3) return

    if (u.isDisqualified) {
      list.push({
        id,
        handle: u.handle,
        approvedCount: 0,
        timeMs: Infinity,
        timeStr: '—',
        statuses: u.statuses,
        photoUrls: u.photoUrls,
        isDisqualified: true,
      })
      return
    }

    const completionMs = u.lastTime
    if (!completionMs || completionMs <= startMs) {
      list.push({
        id,
        handle: u.handle,
        approvedCount: u.approvedCount || 0,
        timeStr: '—',
        statuses: u.statuses,
        photoUrls: u.photoUrls,
        isDisqualified: false,
      })
      return
    }

    const timeMs = completionMs - startMs
    list.push({
      id,
      handle: u.handle,
      approvedCount: u.approvedCount || 0,
      timeMs,
      timeStr: formatDetailedTime(timeMs),
      statuses: u.statuses,
      photoUrls: u.photoUrls,
      isDisqualified: false,
    })
  })

  list.sort((a, b) => {
    if (a.isDisqualified && !b.isDisqualified) return 1
    if (!a.isDisqualified && b.isDisqualified) return -1
    if (b.approvedCount !== a.approvedCount) return b.approvedCount - a.approvedCount
    if (a.timeMs !== b.timeMs) return a.timeMs - b.timeMs
    return a.handle.localeCompare(b.handle)
  })

  rankedPlayers.value = list.map((item, i) => ({ ...item, rank: i + 1 }))
}

const detectUserRank = () => {
  const currentUser = JSON.parse(localStorage.getItem('bmg_user') || '{}')
  const myId = currentUser.id
  if (!myId) return

  const myEntry = rankedPlayers.value.find((r) => String(r.id) === String(myId))
  if (myEntry) {
    userRank.value = myEntry.rank
    showRankModal.value = true
  }
}

onUnmounted(() => {
  if (unsub) unsub()
  if (unsubGame) unsubGame()
})

const playerStatus = computed(() => {
  const currentUser = JSON.parse(localStorage.getItem('bmg_user') || '{}')
  const myId = currentUser.id

  if (!myId)
    return { message: 'Not logged in', class: 'text-red-600 text-5xl font-black tracking-tighter' }

  if (rankedPlayers.value.length === 0) {
    return { message: 'Loading...', class: 'text-slate text-5xl font-black tracking-tighter' }
  }

  const myEntry = rankedPlayers.value.find((r) => r.id === myId || String(r.id) === String(myId))

  if (!myEntry)
    return { message: 'Not ranked yet', class: 'text-slate text-5xl font-black tracking-tighter' }

  return {
    message: `Rank #${myEntry.rank}`,
    class: 'text-purple-600 text-5xl font-black tracking-tighter',
  }
})

const statusBg = (s) =>
  s === 'approved'
    ? 'bg-green-500'
    : s === 'rejected'
      ? 'bg-red-500'
      : s === 'disqualified'
        ? 'bg-gray-950'
        : 'bg-gray-300'

const getRankColor = (rank) => {
  if (rank === 1) return 'text-yellow-600'
  if (rank === 2) return 'text-gray-600'
  if (rank === 3) return 'text-orange-600'
  return 'text-purple-600'
}

const rankBadge = (r) => {
  if (r === 1) return 'bg-yellow-500'
  if (r === 2) return 'bg-gray-600'
  if (r === 3) return 'bg-orange-500'
  return 'bg-purple-600'
}

const rankBg = (r) => {
  if (r === 1)
    return 'flex items-center justify-between rounded-lg transition-all border bg-yellow-50 border-yellow-400 shadow-xl'
  if (r === 2)
    return 'flex items-center justify-between rounded-lg transition-all border bg-gray-50 border-gray-400 shadow-xl'
  if (r === 3)
    return 'flex items-center justify-between rounded-lg transition-all border bg-orange-50 border-orange-400 shadow-xl'
  return 'flex items-center justify-between rounded-lg transition-all border bg-purple-50 border-purple-400 shadow-xl'
}

function formatDetailedTime(ms) {
  if (typeof ms !== 'number' || ms < 0) return '—'
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  const milliseconds = ms % 1000
  return `${minutes}m ${seconds.toString().padStart(2, '0')}s ${milliseconds.toString().padStart(3, '0')}ms`
}
</script>

<template>
  <div class="main min-h-screen bg-soft font-montserrat">
    <header class="bg-white shadow-xl px-4 py-4 sticky top-0 z-10">
      <div class="flex justify-between items-center w-full max-w-4xl mx-auto">
        <div class="flex items-center gap-2">
          <img src="/BMG-Logo.png" class="w-24 h-12" alt="BringMe Game Logo" />
        </div>
        <button
          @click="showExitModal = true"
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
          Exit Leaderboard
        </button>
      </div>
    </header>

    <div class="max-w-4xl mx-auto px-4 py-6">
      <div class="flex justify-center items-center mt-4 md:mt-12 mb-2">
        <img :src="leaderboardLogo" alt="Leaderboard Logo" class="h-28 md:h-44" />
      </div>

      <div v-if="loading" class="text-center py-20 text-slate">Loading, please wait patiently</div>

      <div v-else class="space-y-4">
        <!-- CHANGE 2: Top 5 lang mag-show -->
        <div
          v-for="entry in rankedPlayers.slice(0, 5)"
          :key="entry.id"
          class="grid grid-cols-2 gap-4"
        >
          <div class="flex items-center p-3 md:p-4 rounded-md" :class="rankBg(entry.rank)">
            <h6
              class="w-8 h-8 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-2xl mr-2 shadow-md"
              :class="rankBadge(entry.rank)"
            >
              {{ entry.rank }}<sup>{{ ['st', 'nd', 'rd'][entry.rank - 1] || 'th' }}</sup>
            </h6>
            <div class="flex-1 min-w-0">
              <div
                class="font-semibold text-sm md:text-xl font-montserrat max-w-[23ch] sm:max-w-full truncate"
                :class="getRankColor(entry.rank)"
              >
                {{ entry.handle }}
              </div>
            </div>
          </div>

          <!-- Status squares, clickable if has photo -->
          <div class="grid grid-cols-3 gap-4">
            <div v-for="i in [0, 1, 2]" :key="i" class="flex justify-center">
              <div
                class="w-full h-auto rounded-md flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md transition-all"
                :class="[
                  statusBg(entry.statuses[i]),
                  (entry.statuses[i] === 'approved' || entry.statuses[i] === 'rejected') &&
                  entry.photoUrls?.[i]
                    ? 'cursor-pointer hover:opacity-80 hover:scale-105'
                    : '',
                ]"
                @click="
                  entry.statuses[i] === 'approved' || entry.statuses[i] === 'rejected'
                    ? openPhotoModal(entry.photoUrls?.[i], i)
                    : null
                "
              ></div>
            </div>
          </div>
        </div>

        <div
          class="mt-12 p-10 bg-white rounded-3xl shadow-2xl border border-purple-200 text-center"
        >
          <p class="text-lg tracking-wider text-slate mb-4">You are currently...</p>
          <p class="font-semibold text-2xl" :class="playerStatus.class">
            {{ playerStatus.message }}
          </p>
        </div>
      </div>
    </div>

    <!-- Photo Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showPhotoModal && selectedPhoto"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          @click.self="closePhotoModal"
        >
          <div class="bg-white rounded-md shadow-2xl max-w-xl w-full overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 py-4">
              <p class="text-sm font-semibold text-dark-gray">
                {{ game?.prompts?.[selectedPromptIndex] || `Prompt ${selectedPromptIndex + 1}` }}
              </p>
              <button
                @click="closePhotoModal"
                class="text-dark-gray hover:text-primary transition cursor-pointer"
              >
                <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <!-- Image -->
            <div class="p-4">
              <img
                :src="selectedPhoto"
                alt="Submission"
                class="w-full rounded-xl object-contain max-h-[60vh]"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <GameEndModal
      v-model="showRankModal"
      :user-rank="userRank"
      @exit="showRankModal = false"
      @logout="confirmExit"
    />

    <Transition name="fade">
      <div
        v-if="showExitModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
      >
        <div class="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full">
          <h3 class="text-xl font-bold text-dark-gray mb-3">Exit Leaderboard?</h3>
          <p class="text-slate mb-6">This will log you out and return to the home screen.</p>
          <div class="flex gap-4 justify-center">
            <button
              @click="cancelExit"
              class="px-8 py-3 bg-gray-200 text-dark-gray rounded-xl hover:bg-gray-300 transition cursor-pointer"
              :disabled="isLoggingOut"
            >
              Cancel
            </button>
            <button
              @click="confirmExit"
              class="px-8 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition cursor-pointer"
              :disabled="isLoggingOut"
            >
              {{ isLoggingOut ? 'Logging out...' : 'Yes, exit' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
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
