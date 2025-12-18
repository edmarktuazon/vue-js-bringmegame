<script setup>
import BMGLogo from '/BMG-Logo.png'
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '/firebase/config'
import { createUser, getActiveGame, updateUserCurrentGame } from '/firebase/gameHelpers'

const router = useRouter()

const instagramHandle = ref('')
const loading = ref(false)
const errorMessage = ref('')
const activeGame = ref(null)
let unsubscribeGame = null

onMounted(async () => {
  try {
    activeGame.value = await getActiveGame()

    if (activeGame.value) {
      const gameRef = doc(db, 'games', activeGame.value.id)
      unsubscribeGame = onSnapshot(gameRef, (doc) => {
        if (doc.exists()) {
          activeGame.value = { id: doc.id, ...doc.data() }
        } else {
          activeGame.value = null
        }
      })
    }
  } catch (error) {
    console.error(error)
  }
})

onUnmounted(() => {
  if (unsubscribeGame) unsubscribeGame()
})

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

    console.log('✅ User joined game:', handle)

    router.push('/game')
  } catch (error) {
    console.error('❌ Error joining game:', error)
    errorMessage.value = error.message || 'Failed to join game. Please try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="main flex flex-col justify-center items-center font-montserrat px-4">
    <form class="relative w-full max-w-sm text-center" @submit="handleSubmit">
      <div class="rounded-lg bg-white shadow-xl w-full">
        <!-- logo and text -->
        <div class="flex items-center flex-col px-6 pt-6">
          <img :src="BMGLogo" class="w-48 h-24.25 mb-10" alt="Bring Me Game Logo" />
          <div class="space-y-2">
            <p v-if="activeGame" class="text-xs text-primary font-semibold">
              Game Status: {{ activeGame.status.toUpperCase() }}
            </p>
            <p class="text-sm text-dark-gray mb-2">Enter your Instagram handle to join the game.</p>
          </div>
        </div>

        <!-- Input field and button -->
        <div class="flex items-center flex-col p-6 space-y-4">
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
            :disabled="loading"
            class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-all duration-200 hover:bg-primary/90 focus:outline focus:outline-2 focus:outline-primary disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="loading">Joining...</span>
            <span v-else>Join Game</span>
          </button>
        </div>

        <div class="px-6 pb-6">
          <p class="text-xs text-slate">
            By clicking "Join Game", you agree that you are the owner of the given Instagram handle.
            Any prizes won will be communicated directly via Instagram.
          </p>
        </div>
      </div>
    </form>
  </main>
</template>

<style scoped>
.main {
  height: 100dvh;
  width: 100vw;
  overflow: hidden;
  position: fixed;
  top: 0;
  left: 0;
  background-image: radial-gradient(circle, hsl(270 50% 88%) 0.125rem, transparent 0.125rem);
  background-size: 1.25rem 1.25rem;
}
</style>
