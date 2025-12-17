<script setup>
defineProps({
  completionTime: Object,
  isLoggingOut: Boolean,
})

const emit = defineEmits(['exit'])

const modelValue = defineModel()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4"
    >
      <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full text-center">
        <div class="mb-6">
          <div
            class="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"
          >
            <svg
              class="w-10 h-10 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 class="text-2xl font-bold text-dark-gray mb-2">🎉 Challenge Complete!</h3>
          <p class="text-slate mb-6">You've successfully uploaded all 3 photos!</p>
        </div>

        <div class="bg-primary/10 rounded-lg p-6 mb-6">
          <p class="text-sm text-slate mb-2">Your completion time:</p>
          <div class="text-3xl font-bold tracking-wider text-primary">
            {{ completionTime?.formattedTime || 'Calculating...' }}
          </div>
        </div>

        <p class="text-sm text-slate mb-6">
          Your submission is now under review. Winners will be contacted via Instagram.
        </p>
        <button
          @click="emit('exit')"
          :disabled="isLoggingOut"
          class="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary disabled:opacity-50 cursor-pointer"
        >
          {{ isLoggingOut ? 'Exiting game...' : 'Exit Game' }}
        </button>
      </div>
    </div>
  </Transition>
</template>
