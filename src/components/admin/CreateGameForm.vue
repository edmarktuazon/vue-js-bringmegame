<script setup>
import { ref } from 'vue'
import { createGame } from '/firebase/gameHelpers'
import { auth } from '/firebase/config'

const props = defineProps({
  currentGame: Object,
  loadingGame: Boolean,
})

const emit = defineEmits(['game-created'])

const prompt1 = ref('')
const prompt2 = ref('')
const prompt3 = ref('')
const creating = ref(false)

const handleCreateGame = async () => {
  const p1 = prompt1.value?.trim()
  const p2 = prompt2.value?.trim()
  const p3 = prompt3.value?.trim()

  if (!p1 || !p2 || !p3) {
    alert('3 prompts are required to create and start the game')
    return
  }

  try {
    creating.value = true
    await createGame([p1, p2, p3], auth.currentUser.email)
    prompt1.value = prompt2.value = prompt3.value = ''
    emit('game-created')
    alert('New game successfully created!')
  } catch (err) {
    alert(err.message)
  } finally {
    creating.value = false
  }
}
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex items-center gap-2 mb-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      <h2 class="text-lg font-semibold text-dark-gray">Create New Game</h2>
    </div>
    <p class="text-xs text-slate mb-4">
      Enter 3 prompts to start a new game. This will reset the current game and archive the previous
      one.
    </p>

    <!-- Prompt input fields -->
    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 1</label>
        <input
          v-model="prompt1"
          type="text"
          placeholder="e.g., picture of something blue"
          class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 2</label>
        <input
          v-model="prompt2"
          type="text"
          placeholder="e.g., something to eat"
          class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 3</label>
        <input
          v-model="prompt3"
          type="text"
          placeholder="e.g., a picture of your pillow"
          class="w-full px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <button
        @click="handleCreateGame"
        :disabled="creating || props.loadingGame"
        class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
      >
        {{ creating ? 'Creating...' : 'Create and Start Game' }}
      </button>
    </div>
  </div>
</template>
