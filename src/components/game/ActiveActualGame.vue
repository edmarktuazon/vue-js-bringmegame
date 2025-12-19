<script setup>
import { computed } from 'vue'
import UploadedPhotosGrid from './UploadedPhotosGrid.vue'
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

    <!-- Upload -->
    <div v-if="nextPromptIndex !== null" class="space-y-4">
      <div class="bg-white rounded-lg shadow-sm p-12">
        <h4 class="text-dark-gray mb-6 text-center font-bold text-2xl">
          Bring me: {{ props.game?.prompts?.[nextPromptIndex] }}
        </h4>

        <label
          :class="[
            'flex flex-col items-center justify-center gap-4 w-full px-6 py-8 border-2 border-dashed rounded-xl cursor-pointer transition h-56',
            uploadingPrompt === nextPromptIndex
              ? 'border-primary bg-primary/10'
              : 'border-slate hover:border-primary hover:bg-primary/10',
          ]"
        >
          <svg
            v-if="uploadingPrompt !== nextPromptIndex"
            class="w-16 h-16 text-slate"
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
              stroke-width="2"
              d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>

          <svg v-else class="w-16 h-16 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
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

          <span
            class="text-center text-base font-medium"
            :class="uploadingPrompt === nextPromptIndex ? 'text-primary' : 'text-slate'"
          >
            {{
              uploadingPrompt === nextPromptIndex
                ? 'Uploading your photo...'
                : 'Tap here to take or upload a photo!'
            }}
          </span>

          <input
            type="file"
            accept="image/*;capture=environment,image/jpeg"
            capture="environment"
            class="hidden"
            :disabled="uploadingPrompt === nextPromptIndex"
            @change="(e) => emit('photo-select', nextPromptIndex, e)"
          />
        </label>

        <!-- Uploaded photos -->
        <UploadedPhotosGrid v-if="Object.keys(submissions).length > 0" :submissions="submissions" />
      </div>
    </div>

    <!-- Completion message -->
    <div v-else class="bg-primary/10 border-2 border-primary rounded-lg p-8 text-center">
      <p class="text-primary font-bold text-xl mb-2">
        🎉 Congratulations! You've completed all prompts!
      </p>
      <p class="text-dark-gray">Your submission is now under review. Good luck!</p>
    </div>
  </div>
</template>
