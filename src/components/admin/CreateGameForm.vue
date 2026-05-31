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

const exampleFiles = ref([null, null, null])
const examplePreviews = ref([null, null, null])

const handleExamplePhoto = (index, e) => {
  const file = e.target.files[0]
  if (!file) return
  exampleFiles.value[index] = file
  examplePreviews.value[index] = URL.createObjectURL(file)
}

const removeExamplePhoto = (index) => {
  if (examplePreviews.value[index]) {
    URL.revokeObjectURL(examplePreviews.value[index])
  }
  exampleFiles.value[index] = null
  examplePreviews.value[index] = null
}

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
    await createGame([p1, p2, p3], auth.currentUser.email, exampleFiles.value)
    prompt1.value = prompt2.value = prompt3.value = ''
    exampleFiles.value = [null, null, null]
    examplePreviews.value = [null, null, null]
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
      Enter 3 prompts to start a new game. This will reset the current game.
    </p>

    <!-- Prompt input fields -->
    <div class="space-y-6">
      <!-- Prompt 1 -->
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 1</label>
        <div class="flex gap-3 items-start">
          <!-- Text input -->
          <input
            v-model="prompt1"
            type="text"
            placeholder="e.g., picture of something blue"
            class="flex-1 px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <!-- Photo upload box -->
          <div class="shrink-0">
            <div v-if="examplePreviews[0]" class="relative w-16 h-16">
              <img
                :src="examplePreviews[0]"
                class="w-16 h-16 object-cover rounded-md border border-light"
              />
              <button
                @click="removeExamplePhoto(0)"
                type="button"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-red-600 transition"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <label
              v-else
              class="w-16 h-16 flex flex-col items-center justify-center bg-soft rounded-md border-2 border-dashed border-primary/40 cursor-pointer hover:bg-primary/10 transition"
            >
              <svg
                class="w-6 h-6 text-primary/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleExamplePhoto(0, $event)"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- Prompt 2 -->
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 2</label>
        <div class="flex gap-3 items-start">
          <input
            v-model="prompt2"
            type="text"
            placeholder="e.g., something to eat"
            class="flex-1 px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div class="shrink-0">
            <div v-if="examplePreviews[1]" class="relative w-16 h-16">
              <img
                :src="examplePreviews[1]"
                class="w-16 h-16 object-cover rounded-md border border-light"
              />
              <button
                @click="removeExamplePhoto(1)"
                type="button"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-red-600 transition"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <label
              v-else
              class="w-16 h-16 flex flex-col items-center justify-center bg-soft rounded-md border-2 border-dashed border-primary/40 cursor-pointer hover:bg-primary/10 transition"
            >
              <svg
                class="w-6 h-6 text-primary/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleExamplePhoto(1, $event)"
              />
            </label>
          </div>
        </div>
      </div>

      <!-- Prompt 3 -->
      <div>
        <label class="block text-sm font-medium text-dark-gray mb-2">Prompt 3</label>
        <div class="flex gap-3 items-start">
          <input
            v-model="prompt3"
            type="text"
            placeholder="e.g., a picture of your pillow"
            class="flex-1 px-3 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <div class="shrink-0">
            <div v-if="examplePreviews[2]" class="relative w-16 h-16">
              <img
                :src="examplePreviews[2]"
                class="w-16 h-16 object-cover rounded-md border border-light"
              />
              <button
                @click="removeExamplePhoto(2)"
                type="button"
                class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center cursor-pointer hover:bg-red-600 transition"
              >
                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="3"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <label
              v-else
              class="w-16 h-16 flex flex-col items-center justify-center bg-soft rounded-md border-2 border-dashed border-primary/40 cursor-pointer hover:bg-primary/10 transition"
            >
              <svg
                class="w-6 h-6 text-primary/60"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleExamplePhoto(2, $event)"
              />
            </label>
          </div>
        </div>
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
