<script setup>
defineProps({
  promptIndex: {
    type: Number,
    required: true,
  },
  promptText: {
    type: String,
    required: true,
  },
  submission: {
    type: Object,
    default: null,
  },
  uploadingPrompt: {
    type: Number,
    default: null,
  },
})

defineEmits(['photo-upload'])
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex items-start justify-between mb-4">
      <div class="flex-1">
        <h3 class="text-lg font-semibold text-dark mb-2">Prompt {{ promptIndex + 1 }}</h3>
        <p class="text-sm text-slate">{{ promptText }}</p>
      </div>

      <!-- Status Badge -->
      <span
        v-if="submission"
        :class="[
          'px-3 py-1 rounded-full text-xs font-semibold',
          submission.status === 'approved'
            ? 'bg-green-100 text-green-700'
            : submission.status === 'rejected'
              ? 'bg-red-100 text-red-700'
              : 'bg-yellow-100 text-yellow-700',
        ]"
      >
        {{
          submission.status === 'approved'
            ? '✓ Approved'
            : submission.status === 'rejected'
              ? '✗ Rejected'
              : '⏳ Pending'
        }}
      </span>
    </div>

    <!-- Photo Preview or Upload -->
    <div class="mt-4">
      <div v-if="submission" class="space-y-3">
        <img
          :src="submission.photoUrl"
          alt="Submission"
          class="w-full h-64 object-cover rounded-md"
        />

        <!-- Reupload button if rejected -->
        <label
          v-if="submission.status === 'rejected'"
          class="flex items-center justify-center gap-2 w-full px-4 py-3 bg-primary text-white font-semibold rounded-md cursor-pointer hover:bg-primary/90 transition"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          Reupload Photo
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="$emit('photo-upload', promptIndex, $event)"
          />
        </label>
      </div>

      <!-- Upload button (no submission yet) -->
      <label
        v-else
        :class="[
          'flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed rounded-md cursor-pointer transition',
          uploadingPrompt === promptIndex
            ? 'border-primary bg-primary/5'
            : 'border-slate hover:border-primary hover:bg-primary/5',
        ]"
      >
        <svg
          v-if="uploadingPrompt !== promptIndex"
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
        <span :class="uploadingPrompt === promptIndex ? 'text-primary' : 'text-slate'">
          {{ uploadingPrompt === promptIndex ? 'Uploading...' : 'Upload Photo' }}
        </span>
        <input
          type="file"
          accept="image/*"
          class="hidden"
          :disabled="uploadingPrompt === promptIndex"
          @change="$emit('photo-upload', promptIndex, $event)"
        />
      </label>
    </div>
  </div>
</template>
