<script setup>
import UploadedPhotosGrid from './UploadedPhotosGrid.vue'

defineProps({
  game: Object,
  user: Object,
  submissions: Object,
  nextPromptIndex: Number,
  uploadingPrompt: Number,
})

const emit = defineEmits(['photo-select'])
</script>

<template>
  <div>
    <!-- Progress bar -->
    <div class="bg-gray-200 rounded-full h-4 mb-6 overflow-hidden">
      <div
        class="bg-primary h-4 transition-all"
        :style="{
          width: `${(Object.keys(submissions || {}).length / (game.prompts?.length || 1)) * 100}%`,
        }"
      ></div>
    </div>

    <!-- Current prompt upload -->
    <div v-if="nextPromptIndex !== null" class="space-y-4">
      <div class="bg-white rounded-lg shadow-sm p-6">
        <h3 class="text-lg font-semibold text-dark-gray mb-2">
          <h4 class="text-lg text-primary mb-16">{{ user?.instagramHandle }}</h4>
        </h3>
        <h4 class="text-dark-gray mb-4 text-center font-bold text-2xl">
          Bring me: {{ game.prompts[nextPromptIndex] }}
        </h4>

        <UploadedPhotosGrid v-if="Object.keys(submissions).length > 0" :submissions="submissions" />

        <label
          :class="[
            'flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition mt-4 h-44',
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
            {{
              uploadingPrompt === nextPromptIndex
                ? 'Uploading...'
                : 'Hurry! Tap here to take or upload a photo!'
            }}
          </span>
          <input
            type="file"
            accept="image/*"
            class="hidden"
            :disabled="uploadingPrompt === nextPromptIndex"
            @change="(e) => emit('photo-select', nextPromptIndex, e)"
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
</template>
