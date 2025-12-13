<script setup>
import { ref, onMounted, computed, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { getActiveGame, getUserSubmissions, submitPhoto } from '/firebase/gameHelpers'
import { db } from '/firebase/config'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'

const router = useRouter()

const user = ref(null)
const game = ref(null)
const submissions = ref({})
const loading = ref(true)
const uploadingPrompt = ref(null)
const liveFeed = ref([])

let unsubscribeGame = null
let unsubscribeFeed = null

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
      alert('No active game found')
      router.push('/')
      return
    }

    submissions.value = (await getUserSubmissions(game.value.id, user.value.id)) || {}

    setupGameListener()
    setupLiveFeedListener()
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
})

const setupGameListener = () => {
  if (!game.value) return
  const q = query(collection(db, 'games'), where('isActive', '==', true))
  unsubscribeGame = onSnapshot(q, (snapshot) => {
    if (!snapshot.empty) {
      game.value = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
      console.log('🔄 Game updated:', game.value.status)
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

// Index of the next prompt user should upload
const nextPromptIndex = computed(() => {
  if (!game.value || !submissions.value) return 0
  for (let i = 0; i < game.value.prompts.length; i++) {
    if (!submissions.value[i]) return i
  }
  return null
})

const handlePhotoUpload = async (promptIndex, file) => {
  if (!file) return
  uploadingPrompt.value = promptIndex

  try {
    console.log('Uploading...')
    const url = await submitPhoto(
      game.value.id,
      user.value.id,
      user.value.instagramHandle,
      promptIndex,
      file,
    )
    console.log('Upload done:', url)

    // Refresh submissions
    submissions.value = await getUserSubmissions(game.value.id, user.value.id)
  } catch (error) {
    console.error('Upload failed:', error)
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
  <div class="min-h-screen bg-soft font-montserrat">
    <header class="bg-white shadow-xl px-4 py-6 sticky top-0 z-10">
      <div class="flex justify-between items-center w-full max-w-4xl mx-auto">
        <div>
          <span class="text-xl font-bold">Bring<span class="text-primary">Me</span></span>
          <p class="text-xs text-slate mt-1">{{ user?.instagramHandle }}</p>
        </div>
        <button @click="handleLogout" class="text-sm text-slate hover:text-dark transition">
          Exit Game
        </button>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-8">
      <!-- Loading -->
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

      <!-- Waiting or Starting State -->
      <div
        v-else-if="game?.status === 'waiting' || game?.status === 'starting'"
        class="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        <div class="lg:col-span-2">
          <div class="bg-white rounded-lg shadow-sm p-8 text-center">
            <h2 class="text-2xl font-bold text-dark mb-2">Welcome, {{ user?.instagramHandle }}!</h2>
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
        </div>

        <!-- Live Feed -->
        <div class="lg:col-span-1">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <div class="flex items-center gap-2 mb-4">
              <svg
                class="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
              <h3 class="font-semibold text-dark">Live Feed</h3>
            </div>
            <p class="text-xs text-slate mb-4">Users who have joined the game.</p>
            <div v-if="liveFeed.length === 0" class="text-center py-8 text-slate text-sm">
              No users yet.
            </div>
            <div v-else class="space-y-2 max-h-96 overflow-y-auto">
              <div
                v-for="feedUser in liveFeed"
                :key="feedUser.id"
                class="flex items-center gap-2 p-2 bg-soft rounded-md"
              >
                <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
                  <span class="text-primary font-bold text-xs">{{
                    feedUser.instagramHandle.charAt(1).toUpperCase()
                  }}</span>
                </div>
                <span class="text-sm text-dark">{{ feedUser.instagramHandle }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Game Ended -->
      <div
        v-else-if="game?.status === 'ended'"
        class="bg-white rounded-lg shadow-sm p-8 text-center"
      >
        <h2 class="text-2xl font-bold text-dark mb-2">Game Has Ended</h2>
        <p class="text-slate mb-6">
          This game has concluded. Thank you for participating! Winners will be contacted via
          Instagram.
        </p>
        <button
          @click="handleLogout"
          class="px-6 py-3 bg-primary text-white font-semibold rounded-md hover:bg-primary/90 transition"
        >
          Exit Game
        </button>
      </div>

      <!-- Active Game -->
      <div v-else>
        <div v-if="game?.prize?.description" class="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div class="flex items-center gap-4">
            <img
              v-if="game.prize.logoUrl"
              :src="game.prize.logoUrl"
              alt="Prize"
              class="w-16 h-16 object-cover rounded-md"
            />
            <div class="flex-1">
              <h3 class="text-sm font-semibold text-dark mb-1">🏆 Prize</h3>
              <p class="text-sm text-slate">{{ game.prize.description }}</p>
            </div>
          </div>
        </div>

        <!-- Progress bar -->
        <div class="bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
          <div
            class="bg-primary h-4 transition-all"
            :style="{
              width: `${(Object.keys(submissions.value || {}).length / (game.prompts?.length || 1)) * 100}%`,
            }"
          ></div>
        </div>

        <!-- Prompt Uploads -->
        <div v-if="nextPromptIndex !== null" class="space-y-4">
          <div class="bg-white rounded-lg shadow-sm p-6">
            <h3 class="text-lg font-semibold text-dark mb-2">Prompt {{ nextPromptIndex + 1 }}</h3>
            <p class="text-sm text-slate">{{ game.prompts[nextPromptIndex] }}</p>

            <label
              :class="[
                'flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition mt-4',
                uploadingPrompt === nextPromptIndex
                  ? 'border-primary bg-primary/5'
                  : 'border-slate hover:border-primary hover:bg-primary/5',
              ]"
            >
              <svg
                v-if="uploadingPrompt !== nextPromptIndex"
                class="w-5 h-5 text-slate"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <svg v-else class="w-5 h-5 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
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
              <span :class="uploadingPrompt === nextPromptIndex ? 'text-primary' : 'text-slate'">
                {{ uploadingPrompt === nextPromptIndex ? 'Uploading...' : 'Upload Photo' }}
              </span>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                :disabled="uploadingPrompt === nextPromptIndex"
                @change="handlePhotoUpload(nextPromptIndex, $event)"
              />
            </label>
          </div>
        </div>

        <div v-else class="bg-primary/10 border-2 border-primary rounded-lg p-4 mb-6">
          <p class="text-primary font-semibold text-center">
            🎉 All prompts completed! Your submission is under review.
          </p>
        </div>
      </div>
    </main>
  </div>
</template>
