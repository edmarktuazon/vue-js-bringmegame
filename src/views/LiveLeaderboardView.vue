<script setup>
import leaderboardLogo from '../assets/images/leaderboard-logo.jpg'
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { onSnapshot, collection, getDocs } from 'firebase/firestore'
import { db } from '/firebase/config'
import { getActiveGame } from '/firebase/gameHelpers'
import { useRouter } from 'vue-router'

const router = useRouter()

const game = ref(null)
const rankedPlayers = ref([])
const topFive = ref([])
const loading = ref(true)

const showExitModal = ref(false)
const isLoggingOut = ref(false)

const confirmExit = () => {
  isLoggingOut.value = true
  localStorage.removeItem('bmg_user')
  router.push('/')
}

const cancelExit = () => {
  showExitModal.value = false
}

let unsub = null

onMounted(async () => {
  game.value = await getActiveGame()
  if (!game.value) return router.push('/')

  await loadData()
  unsub = onSnapshot(collection(db, 'games', game.value.id, 'submissions'), loadData)

  loading.value = false
})

const loadData = async () => {
  if (!game.value?.id) return

  const snap = await getDocs(collection(db, 'games', game.value.id, 'submissions'))
  const userMap = new Map()

  snap.forEach((d) => {
    const data = d.data()
    if (!data.userId || data.promptIndex == null) return

    if (!userMap.has(data.userId)) {
      userMap.set(data.userId, {
        handle: data.instagramHandle || 'unknown',
        approvedCount: 0,
        statuses: [null, null, null],
        count: 0,
      })
    }

    const u = userMap.get(data.userId)
    u.count++
    u.statuses[data.promptIndex] = data.status

    if (data.status === 'approved' && data.uploadedAt) {
      u.approvedCount++
    }
  })

  const list = []
  userMap.forEach((u, id) => {
    if (u.count !== 3) return

    list.push({
      id,
      handle: u.handle,
      approvedCount: u.approvedCount,
      statuses: u.statuses,
    })
  })

  list.sort((a, b) => {
    if (b.approvedCount !== a.approvedCount) {
      return b.approvedCount - a.approvedCount
    }

    if (a.timeMs !== b.timeMs) {
      return a.timeMs - b.timeMs
    }
    return a.handle.localeCompare(b.handle)
  })

  rankedPlayers.value = list.map((item, i) => ({ ...item, rank: i + 1 }))
  topFive.value = rankedPlayers.value.slice(0, 5)

  const currentUser = JSON.parse(localStorage.getItem('bmg_user') || '{}')
  const myId = currentUser.id

  if (!myId) {
    playerStatus.value = {
      message: 'Not logged in',
      class: 'text-red-600 text-5xl font-black tracking-tighter',
    }
    return
  }

  const myEntry = rankedPlayers.value.find((r) => r.id === myId || String(r.id) === String(myId))

  if (myEntry) {
    if (myEntry.rank <= 5) {
      playerStatus.value = {
        message: 'In the Top 5',
        class: 'text-green-600 text-5xl font-black tracking-tighter',
      }
    } else {
      playerStatus.value = {
        message: `Rank #${myEntry.rank}`,
        class: 'text-purple-600 text-5xl font-black tracking-tighter',
      }
    }
  } else {
    playerStatus.value = {
      message: 'Not ranked yet',
      class: 'text-slate text-5xl font-black tracking-tighter',
    }
  }
}

const playerStatus = computed(() => {
  const currentUser = JSON.parse(localStorage.getItem('bmg_user') || '{}')
  const myId = currentUser.id

  if (!myId) {
    return {
      message: 'Not logged in',
      class: 'text-red-600 text-5xl font-black tracking-tighter',
    }
  }

  // Wait for data to load
  if (rankedPlayers.value.length === 0) {
    return {
      message: 'Loading...',
      class: 'text-slate text-5xl font-black tracking-tighter',
    }
  }

  const myEntry = rankedPlayers.value.find((r) => r.id === myId || String(r.id) === String(myId))

  if (!myEntry) {
    return {
      message: 'Not ranked yet',
      class: 'text-slate text-5xl font-black tracking-tighter',
    }
  }

  if (myEntry.rank <= 5) {
    return {
      message: 'In the Top 5',
      class: 'text-green-600 text-5xl font-black tracking-tighter',
    }
  }

  return {
    message: `Rank #${myEntry.rank}`,
    class: 'text-purple-600 text-5xl font-black tracking-tighter',
  }
})

onUnmounted(() => unsub && unsub())

const statusBg = (s) =>
  s === 'approved' ? 'bg-green-500' : s === 'rejected' ? 'bg-red-500' : 'bg-gray-300'

const rankBadge = (r) => {
  if (r === 1) return 'bg-yellow-500'
  if (r === 2) return 'bg-gray-600'
  if (r === 3) return 'bg-orange-500'
  if (r === 4) return 'bg-purple-500'
  if (r === 5) return 'bg-purple-500'
  return 'bg-blue-500'
}

const rankBg = (r) => {
  if (r === 1)
    return 'flex items-center justify-between rounded-lg transition-all border bg-yellow-50 border-yellow-400 shadow-xl'
  if (r === 2)
    return 'flex items-center justify-between rounded-lg transition-all border bg-gray-50 border-gray-400 shadow-xl'
  if (r === 3)
    return 'flex items-center justify-between rounded-lg transition-all border bg-orange-50 border-orange-400 shadow-xl'
  if (r === 4)
    return 'flex items-center justify-between rounded-lg transition-all border bg-purple-50 border-purple-400 shadow-xl'
  if (r === 5)
    return 'flex items-center justify-between rounded-lg transition-all border bg-purple-50 border-purple-400 shadow-xl'
  return 'flex items-center justify-between rounded-lg transition-all border bg-blue-50 border-blue-400 shadow-xl'
}
</script>

<template>
  <div class="min-h-screen bg-soft font-montserrat">
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

    <div
      v-if="game?.status === 'ended'"
      class="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center px-4"
    >
      <div class="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full border border-purple-200">
        <h2 class="text-4xl font-bold text-dark-gray mb-6">Game Has Ended!</h2>
        <p class="text-lg text-slate mb-8">
          The game has concluded. Thank you for participating! Winners will be contacted via
          Instagram. You can exit now
        </p>
        <button
          @click="confirmExit"
          class="px-10 py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary/90 transition cursor-pointer"
          :disabled="isLoggingOut"
        >
          {{ isLoggingOut ? 'Logging out...' : 'Exit' }}
        </button>
      </div>
    </div>

    <div class="max-w-4xl mx-auto px-4 py-6">
      <div class="flex justify-center items-center my-12">
        <img :src="leaderboardLogo" alt="Leaderboard Logo" class="h-16 md:h-24" />
      </div>

      <div v-if="loading" class="text-center py-20 text-slate">Loading, please wait patiently</div>

      <div v-else class="space-y-4">
        <div v-for="entry in topFive" :key="entry.id" class="grid grid-cols-2 gap-4">
          <div class="flex items-center p-3 md:p-4 rounded-md" :class="rankBg(entry.rank)">
            <div
              class="w-8 h-8 md:w-14 md:h-14 rounded-full flex items-center justify-center text-white font-bold text-sm md:text-2xl mr-2 shadow-md"
              :class="rankBadge(entry.rank)"
            >
              {{ entry.rank
              }}<sup class="text-sm">{{ ['st', 'nd', 'rd'][entry.rank - 1] || 'th' }}</sup>
            </div>
            <div class="flex-1">
              <div class="font-semibold text-sm md:text-xl text-dark-gray font-montserrat">
                {{ entry.handle }}
              </div>
            </div>
          </div>
          <div class="grid grid-cols-3 gap-4">
            <div v-for="i in [0, 1, 2]" :key="i" class="flex justify-center">
              <div
                class="w-full h-auto rounded-md flex items-center justify-center text-white font-bold text-xs md:text-sm shadow-md"
                :class="statusBg(entry.statuses[i])"
              >
                <span v-if="entry.statuses[i] === 'approved'">Approved</span>
                <span v-else-if="entry.statuses[i] === 'rejected'">Rejected</span>
                <span v-else>Pending</span>
              </div>
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
          <p v-if="playerStatus.rank" class="mt-4 text-slate text-lg">
            (Rank #{{ playerStatus.rank }} overall)
          </p>
        </div>
      </div>
    </div>

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
              {{ isLoggingOut ? 'Logging out...' : 'Exit Leaderboard' }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
