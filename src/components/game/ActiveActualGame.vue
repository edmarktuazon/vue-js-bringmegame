<script setup>
import { computed, ref } from 'vue'
import ConfettiCompletion from './ConfettiCompletion.vue'

const props = defineProps({
  game: Object,
  user: Object,
  submissions: Object,
  nextPromptIndex: Number,
  uploadingPrompt: Number,
})

const emit = defineEmits(['photo-select'])

const isCompleted = computed(() => {
  return props.nextPromptIndex === null
})

// Show Example modal
const showExample = ref(false)
const examplePhoto = ref(null)

const openExample = () => {
  examplePhoto.value = props.game?.promptExampleUrls?.[props.nextPromptIndex]
  showExample.value = true
}

const closeExample = () => {
  showExample.value = false
  examplePhoto.value = null
}
</script>

<template>
  <div>
    <ConfettiCompletion :trigger="isCompleted" />

    <!-- Progress bar -->
    <div class="bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
      <div
        class="bg-primary h-4 transition-all duration-500"
        :style="{
          width: `${(Object.keys(props.submissions || {}).length / (props.game?.prompts?.length || 1)) * 100}%`,
        }"
      ></div>
    </div>

    <!-- Upload Section -->
    <div v-if="nextPromptIndex !== null" class="space-y-4">
      <div class="bg-white rounded-lg shadow-sm p-12">
        <!-- Header -->
        <div class="text-center mb-8">
          <p class="text-sm text-gray-600 mb-2">Bring me:</p>
          <h4 class="text-2xl font-bold text-primary">
            {{ props.game?.prompts?.[nextPromptIndex] }}
          </h4>
        </div>

        <!-- Upload box -->
        <label
          :class="[
            'flex flex-col items-center justify-center gap-4 w-full px-6 py-12 border-2 border-dashed rounded-2xl cursor-pointer transition-all hover:scale-[1.02]',
            uploadingPrompt === nextPromptIndex ? 'bg-gray-50' : 'bg-primary/10 border-primary',
          ]"
        >
          <!-- Camera icon -->
          <svg
            v-if="uploadingPrompt !== nextPromptIndex"
            class="w-20 h-20 text-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
            />
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>

          <!-- Spinner -->
          <svg v-else class="w-20 h-20 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
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

          <!-- Text -->
          <span class="text-center text-2xl font-semibold text-primary">
            {{
              uploadingPrompt === nextPromptIndex
                ? 'Processing your photo...'
                : 'Hurry! Tap here to take a photo!'
            }}
          </span>

          <input
            type="file"
            accept="image/*"
            capture="environment"
            class="hidden"
            :disabled="uploadingPrompt === nextPromptIndex"
            @change="(e) => emit('photo-select', nextPromptIndex, e)"
          />
        </label>

        <!-- Show Example button — only shows if admin uploaded a reference photo -->
        <div class="mt-6">
          <button
            v-if="props.game?.promptExampleUrls?.[nextPromptIndex]"
            @click="openExample"
            class="w-full py-6 border-2 border-primary border-dashed text-2xl text-primary font-semibold rounded-xl hover:bg-primary/10 transition cursor-pointer"
          >
            Show Example
          </button>
        </div>
      </div>
    </div>

    <!-- Completion message -->
    <div v-else class="bg-primary/10 border-2 border-primary rounded-lg p-8 text-center">
      <p class="text-primary font-bold text-xl mb-2">
        🎉 Congratulations! You've completed all prompts!
      </p>
      <p class="text-dark-gray">Your submission is now under review. Good luck!</p>
    </div>

    <!-- Show Example Modal -->
    <Teleport to="body">
      <Transition name="fade">
        <div
          v-if="showExample && examplePhoto"
          class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4"
          @click.self="closeExample"
        >
          <div class="bg-white rounded-md shadow-2xl max-w-xl w-full overflow-hidden">
            <!-- Header -->
            <div class="flex justify-between items-center px-5 py-4">
              <div>&nbsp;</div>
              <button
                @click="closeExample"
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
                :src="examplePhoto"
                alt="Example"
                class="w-full rounded-xl object-contain max-h-[60vh]"
              />
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
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
