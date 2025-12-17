<script setup>
import { ref, onMounted, computed, watch, onUnmounted } from 'vue'
import { auth } from '/firebase/config'
import { useRouter } from 'vue-router'
import { signOut } from 'firebase/auth'
import {
  getActiveGame,
  createGame,
  updateGameStatus,
  updatePrize,
  updateSubmissionStatus,
  getLeaderboard,
  getAllSubmissions,
  listenToSubmissions,
} from '/firebase/gameHelpers'
import { db } from '/firebase/config'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'

const router = useRouter()

// ===============================================
// REFS & STATE
// ===============================================
const currentGame = ref(null)
const gameStatus = ref('waiting')
const prompt1 = ref('')
const prompt2 = ref('')
const prompt3 = ref('')
const approvingId = ref(null)
const rejectingId = ref(null)

const prizeDescription = ref('')
const prizeLogoFile = ref(null)
const prizeLogoPreview = ref(null)

const users = ref(['All Users'])
const selectedUser = ref('All Users')

const activeTab = ref('pending') // pending | approved | rejected

// Real-time submissions (lahat ng uploads instant lalabas)
const submissions = ref([])
let unsubscribeUsers = null
let unsubscribeSubmissions = null

const leaderboard = ref([])

const loadingGame = ref(false)
const loadingSubmissions = ref(false)
const savingPrize = ref(false)

const showLogoutModal = ref(false)
const isLoggingOut = ref(false)

// ===============================================
// LIFECYCLE
// ===============================================
onMounted(() => {
  setupUsersListener()
  setupSubmissionsListener() // ✅ Call once here
  // setupLeaderboardListener()
  loadGameData()
})

onUnmounted(() => {
  if (unsubscribeUsers) unsubscribeUsers()
  if (unsubscribeSubmissions) unsubscribeSubmissions()
})

// ===============================================
// REAL-TIME LISTENERS
// ===============================================

// 1. Users List – permanent kahit magpalit ng game
const setupUsersListener = () => {
  if (unsubscribeUsers) unsubscribeUsers()

  const q = query(
    collection(db, 'users'),
    where('hasJoined', '==', true),
    orderBy('joinedAt', 'desc'),
  )

  unsubscribeUsers = onSnapshot(q, (snapshot) => {
    const list = ['All Users']
    snapshot.forEach((doc) => {
      const handle = doc.data().instagramHandle
      if (handle && !list.includes(handle)) list.push(handle)
    })
    users.value = list.sort()
  })
}

// 2. Submissions – real-time pag may nag-upload
const setupSubmissionsListener = () => {
  if (unsubscribeSubmissions) unsubscribeSubmissions()

  // Import getAllSubmissions first!
  unsubscribeSubmissions = getAllSubmissions((allSubs) => {
    submissions.value = allSubs
    console.log(`📊 Loaded ${allSubs.length} submissions from all games`)
  })
}

// Watch game change → restart submissions listener
// watch(currentGame, () => {
//   setupSubmissionsListener()
// })

// ===============================================
// DATA LOADING
// ===============================================
// const setupLeaderboardListener = () => {
//   if (!currentGame.value?.id) {
//     leaderboard.value = []
//     return
//   }

//   const q = collection(db, 'games', currentGame.value.id, 'submissions')

//   return onSnapshot(q, async () => {
//     // Every time may bagong submission or update, recalculate leaderboard
//     leaderboard.value = await getLeaderboard(currentGame.value.id, false) // false = include pending/rejected
//     console.log('Leaderboard updated:', leaderboard.value)
//   })
// }

// Real-time leaderboard updates
watch(
  () => submissions.value, // Re-run whenever submissions change
  async () => {
    if (!currentGame.value?.id || submissions.value.length === 0) {
      leaderboard.value = []
      return
    }

    leaderboard.value = await getLeaderboard(currentGame.value.id, false)
    console.log('Leaderboard auto-updated!', leaderboard.value)
  },
  { immediate: true }, // Run once on load too
)

// let unsubscribeLeaderboard = null

// NEW: Listener for CURRENT game submissions only
const setupCurrentSubmissionsListener = () => {
  if (unsubscribeSubmissions) unsubscribeSubmissions()

  if (!currentGame.value?.id) {
    submissions.value = []
    return
  }

  unsubscribeSubmissions = listenToSubmissions(currentGame.value.id, (subs) => {
    submissions.value = subs
    console.log(`Real-time submissions: ${subs.length}`)
  })
}

watch(
  () => currentGame.value?.id,
  () => {
    setupCurrentSubmissionsListener()
  },
)

// Watch for game change (important pag nag-create ng bagong game)
watch(
  () => currentGame.value?.id,
  () => {
    setupCurrentSubmissionsListener()
  },
)

const loadGameData = async () => {
  try {
    loadingGame.value = true
    currentGame.value = await getActiveGame()

    if (currentGame.value) {
      gameStatus.value = currentGame.value.status
      prizeDescription.value = currentGame.value.prize?.description || ''
      prizeLogoPreview.value = currentGame.value.prize?.logoUrl || null

      // Setup listener for current game submissions
      setupCurrentSubmissionsListener()

      await loadLeaderboard()
    } else {
      submissions.value = []
      leaderboard.value = []
      if (unsubscribeSubmissions) unsubscribeSubmissions()
    }
  } catch (error) {
    console.error('Error loading game:', error)
  } finally {
    loadingGame.value = false
  }
}

// onUnmounted(() => {
//   if (unsubscribeLeaderboard) unsubscribeLeaderboard()
//   // ... existing unsubscribes
// })

const loadLeaderboard = async () => {
  if (!currentGame.value) return
  leaderboard.value = await getLeaderboard(currentGame.value.id, false)
}

// ===============================================
// FILTERED SUBMISSIONS (by tab + user)
// ===============================================
const currentSubmissions = computed(() => {
  let filtered = submissions.value

  // Filter by status
  if (activeTab.value !== 'all') {
    filtered = filtered.filter((s) => s.status === activeTab.value)
  }

  // Filter by selected user
  if (selectedUser.value !== 'All Users') {
    filtered = filtered.filter((s) => s.instagramHandle === selectedUser.value)
  }

  return filtered
})

const submissionCounts = computed(() => ({
  pending: submissions.value.filter((s) => s.status === 'pending').length,
  approved: submissions.value.filter((s) => s.status === 'approved').length,
  rejected: submissions.value.filter((s) => s.status === 'rejected').length,
}))

// ===============================================
// ACTIONS
// ===============================================
const hasThreePrompts = computed(() => {
  const p = currentGame.value?.prompts
  return p && Array.isArray(p) && p.length === 3 && p.every((s) => s && s.trim().length > 0)
})

const handleCreateGame = async () => {
  const p1 = prompt1.value?.trim()
  const p2 = prompt2.value?.trim()
  const p3 = prompt3.value?.trim()

  if (!p1 || !p2 || !p3) {
    alert('Please fill all 3 prompts!')
    return
  }

  if (!confirm('Start new game with these 3 prompts?')) return

  try {
    loadingGame.value = true
    await createGame([p1, p2, p3], auth.currentUser.email)

    prompt1.value = prompt2.value = prompt3.value = ''

    // ✅ RELOAD GAME DATA to get proper ID
    await loadGameData()

    alert('Game successfully created and STARTED!')
  } catch (err) {
    alert(err.message)
  } finally {
    loadingGame.value = false
  }
}
const handleStatusChange = async () => {
  if (!currentGame.value) return

  try {
    await updateGameStatus(currentGame.value.id, gameStatus.value)
    alert(`Game is now ${gameStatus.value.toUpperCase()}!`)
  } catch (error) {
    alert(error.message) // lalabas yung exact error natin
    gameStatus.value = currentGame.value.status // balik sa dati
  }
}

const handlePrizeLogoUpload = (e) => {
  const file = e.target.files[0]
  if (!file) return
  prizeLogoFile.value = file
  const reader = new FileReader()
  reader.onload = (ev) => (prizeLogoPreview.value = ev.target.result)
  reader.readAsDataURL(file)
}

const handleSavePrize = async () => {
  if (!currentGame.value || !prizeDescription.value) {
    alert('Fill prize details')
    return
  }
  savingPrize.value = true
  try {
    await updatePrize(currentGame.value.id, prizeDescription.value, prizeLogoFile.value)
    alert('Prize saved!')
    await loadGameData()
    // eslint-disable-next-line no-unused-vars
  } catch (_) {
    alert('Failed to save prize')
  } finally {
    savingPrize.value = false
  }
}

const handleApproveSubmission = async (id) => {
  if (!currentGame.value?.id) return
  approvingId.value = id
  try {
    await updateSubmissionStatus(currentGame.value.id, id, 'approved', auth.currentUser.email)
    await loadLeaderboard()
    activeTab.value = 'approved'
  } catch (error) {
    alert('Failed to approve: ' + error.message)
  } finally {
    approvingId.value = null
  }
}

const handleRejectSubmission = async (id) => {
  if (!currentGame.value?.id) return
  rejectingId.value = id
  try {
    await updateSubmissionStatus(currentGame.value.id, id, 'rejected', auth.currentUser.email)
    activeTab.value = 'rejected'
  } catch (error) {
    alert('Failed to reject: ' + error.message)
  } finally {
    rejectingId.value = null
  }
}

const confirmLogout = async () => {
  isLoggingOut.value = true
  await signOut(auth)
  setTimeout(() => router.push('/'), 600)
}
</script>
<template>
  <div class="min-h-screen bg-soft font-montserrat">
    <!-- Header -->
    <header class="bg-white shadow-xl px-4 py-6 sticky top-0 z-20">
      <div class="flex justify-between items-center w-full max-w-6xl mx-auto">
        <span class="text-xl font-bold"> Bring<span class="text-primary">Me</span> </span>
        <button
          @click="showLogoutModal = true"
          class="flex items-center gap-1 text-dark-gray-gray transition cursor-pointer"
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
        <!-- Left column -->
        <div class="space-y-6">
          <!-- Create new game -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Create New Game</h2>
            </div>
            <p class="text-xs text-slate mb-4">
              Enter 3 prompts to start a new game. This will reset the current game and archive the
              previous one.
            </p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 1</label>
                <input
                  v-model="prompt1"
                  type="text"
                  placeholder="e.g., A picture of something blue"
                  class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 2</label>
                <input
                  v-model="prompt2"
                  type="text"
                  placeholder="e.g., Your reflection in a puddle"
                  class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div>
                <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 3</label>
                <input
                  v-model="prompt3"
                  type="text"
                  placeholder="e.g., A shadow that looks like an animal"
                  class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <button
                @click="handleCreateGame"
                :disabled="loadingGame"
                class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
              >
                {{ loadingGame ? 'Creating...' : 'Create and Start Game' }}
              </button>
            </div>
          </div>

          <!-- Game status -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Game Status</h2>
            </div>
            <p class="text-xs text-slate mb-4">
              Update the current status of the game for all players.
            </p>
            <select
              v-model="gameStatus"
              @change="handleStatusChange"
              :disabled="!currentGame"
              class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="waiting">Waiting</option>
              <option value="active" :disabled="!hasThreePrompts">Active</option>
              <option value="ended">Ended</option>
            </select>
          </div>

          <!-- Fastest submissions -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">
                Fastest Submissions (Photos Unverified)
              </h2>
            </div>
            <p class="text-xs text-slate mb-4">
              Live player rankings as they complete all 3 prompts.
            </p>

            <div v-if="leaderboard.length === 0" class="py-8 text-center text-slate text-sm">
              No players have completed all 3 prompts yet.
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="entry in leaderboard"
                :key="entry.userId"
                class="flex items-center justify-between p-4 rounded-lg transition-all"
                :class="{
                  'bg-yellow-50 border-2 border-yellow-400 shadow-lg': entry.rank === 1,
                  'bg-gray-100 border-2 border-gray-400 shadow-md': entry.rank === 2,
                  'bg-orange-50 border-2 border-orange-400 shadow-md': entry.rank === 3,
                  'bg-soft': entry.rank > 3,
                }"
              >
                <div class="flex items-center gap-4">
                  <!-- Rank Badge -->
                  <div class="flex-shrink-0">
                    <div
                      v-if="entry.rank === 1"
                      class="w-12 h-12 bg-yellow-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
                    >
                      1st
                    </div>
                    <div
                      v-else-if="entry.rank === 2"
                      class="w-10 h-10 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    >
                      2nd
                    </div>
                    <div
                      v-else-if="entry.rank === 3"
                      class="w-10 h-10 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg"
                    >
                      3rd
                    </div>
                    <div
                      v-else
                      class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold text-sm"
                    >
                      {{ entry.rank }}
                    </div>
                  </div>

                  <!-- Player Info -->
                  <div>
                    <p class="font-semibold text-dark-gray">{{ entry.instagramHandle }}</p>
                    <p class="text-xs text-slate">Completed all 3 prompts</p>
                  </div>
                </div>

                <!-- Time - Now with detailed format: 3m 16s 230ms -->
                <div class="text-right">
                  <p class="text-lg font-bold text-dark-gray">{{ entry.formattedTime }}</p>
                  <p class="text-xs text-slate">completion time</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Edit prize -->
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Edit Prize</h2>
            </div>
            <p class="text-xs text-slate mb-4">
              Set the prize description and upload a logo. This will be visible to everyone.
            </p>

            <div class="space-y-4">
              <div>
                <label class="block text-sm font-medium text-dark-gray mb-2">Prize Logo</label>
                <div class="flex items-center gap-4">
                  <div
                    class="w-16 h-16 bg-soft rounded-md flex items-center justify-center overflow-hidden"
                  >
                    <img
                      v-if="prizeLogoPreview"
                      :src="prizeLogoPreview"
                      alt="Prize logo"
                      class="w-full h-full object-cover"
                    />
                    <svg
                      v-else
                      class="w-8 h-8 text-slate"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <div>
                    <label
                      class="flex items-center gap-2 px-4 py-2 bg-soft text-dark-gray text-sm rounded-md cursor-pointer hover:bg-light transition"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      Upload Logo
                      <input
                        type="file"
                        accept="image/*"
                        class="hidden"
                        @change="handlePrizeLogoUpload"
                      />
                    </label>
                    <p class="text-xs text-slate mt-1">Recommended: Square image, &lt;1MB</p>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium text-dark-gray mb-2"
                  >Prize Description</label
                >
                <textarea
                  v-model="prizeDescription"
                  placeholder="e.g., A $50 gift card to Starbucks"
                  rows="3"
                  class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                ></textarea>
              </div>
              <button
                @click="handleSavePrize"
                :disabled="savingPrize || !currentGame"
                class="flex items-center justify-center gap-2 w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                  />
                </svg>
                {{ savingPrize ? 'Saving...' : 'Save Prize' }}
              </button>
            </div>
          </div>
        </div>

        <!-- Right column - Photo submissions -->
        <div
          class="bg-white rounded-lg shadow-sm p-6"
          style="max-height: calc(100vh - 200px); overflow-y: auto"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h2 class="text-lg font-semibold text-dark-gray">Photo Submissions</h2>
            </div>
            <div>
              <label class="block text-xs text-slate mb-1">Filter by User</label>
              <select
                v-model="selectedUser"
                class="px-4 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                <option v-for="user in users" :key="user" :value="user">
                  {{ user === 'All Users' ? 'All Users' : user }}
                </option>
              </select>
            </div>
          </div>

          <p class="text-xs text-slate mb-4">
            Review and approve or reject player photo submissions.
          </p>

          <!-- Tabs -->
          <div class="flex gap-4 border-b border-light mb-6">
            <button
              class="cursor-pointer"
              @click="activeTab = 'pending'"
              :class="
                activeTab === 'pending'
                  ? 'border-b-2 border-dark text-dark-gray font-medium'
                  : 'text-slate'
              "
            >
              Pending ({{ submissionCounts.pending }})
            </button>
            <button
              class="cursor-pointer"
              @click="activeTab = 'approved'"
              :class="
                activeTab === 'approved'
                  ? 'border-b-2 border-dark text-dark-gray font-medium'
                  : 'text-slate'
              "
            >
              Approved ({{ submissionCounts.approved }})
            </button>
            <button
              class="cursor-pointer"
              @click="activeTab = 'rejected'"
              :class="
                activeTab === 'rejected'
                  ? 'border-b-2 border-dark text-dark-gray font-medium'
                  : 'text-slate'
              "
            >
              Rejected ({{ submissionCounts.rejected }})
            </button>
          </div>

          <!-- Loading -->
          <div v-if="loadingSubmissions" class="py-12 text-center">
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
          </div>

          <!-- Empty state -->
          <div v-else-if="currentSubmissions.length === 0" class="py-12 text-center">
            <svg
              class="w-12 h-12 text-slate mx-auto mb-3"
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
            <p class="text-slate text-sm">No {{ activeTab }} submissions.</p>
          </div>

          <div v-else class="grid grid-cols-2 gap-4">
            <div
              v-for="sub in currentSubmissions"
              :key="sub.id"
              class="border rounded-lg p-4 bg-white"
            >
              <div class="flex justify-between items-start mb-3">
                <div>
                  <p class="font-bold text-dark-gray">{{ sub.instagramHandle }}</p>
                  <p class="text-xs text-slate">
                    Prompt {{ sub.promptIndex + 1 }} •
                    {{ sub.uploadedAt?.toDate?.().toLocaleString() || 'Just now' }}
                  </p>
                </div>
              </div>
              <img :src="sub.photoUrl" class="w-full h-64 object-cover rounded-md" />
              <div v-if="sub.status === 'pending'" class="flex gap-3 mt-4">
                <button
                  @click="handleApproveSubmission(sub.id)"
                  class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 cursor-pointer"
                >
                  Approve
                </button>
                <button
                  @click="handleRejectSubmission(sub.id)"
                  class="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 cursor-pointer"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- Logout confirmation modal -->
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
              class="px-4 py-2 text-sm font-medium text-dark-gray bg-soft rounded-md cursor-pointer"
            >
              Cancel
            </button>
            <button
              @click="confirmLogout"
              :disabled="isLoggingOut"
              class="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary disabled:opacity-50 cursor-pointer"
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
