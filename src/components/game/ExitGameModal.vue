<script setup>
defineProps({
  isLoggingOut: Boolean,
})

const emit = defineEmits(['confirm', 'update:modelValue'])

const modelValue = defineModel()
</script>

<template>
  <Transition name="fade">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 px-4"
      @click.self="modelValue = false"
    >
      <div class="bg-white rounded-lg shadow-2xl p-6 max-w-sm w-full">
        <h3 class="text-lg font-semibold text-dark-gray mb-2">Confirm Exit Game</h3>
        <p class="text-sm text-slate mb-6">
          If you exit before playing, you will be counted as a non-participant and no data will be
          recorded. If you have already played, you may still exit, but your game record will be
          saved.
        </p>
        <div class="flex gap-3 justify-end">
          <button
            @click="modelValue = false"
            class="px-4 py-2 text-sm font-medium text-dark-gray bg-soft rounded-md cursor-pointer"
          >
            Cancel
          </button>
          <button
            @click="emit('confirm')"
            :disabled="isLoggingOut"
            class="px-4 py-2 text-sm font-medium text-white rounded-md bg-primary disabled:opacity-50 cursor-pointer"
          >
            {{ isLoggingOut ? 'Exiting game...' : 'Exit Game' }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
