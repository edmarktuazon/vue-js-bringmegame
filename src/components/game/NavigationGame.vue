<script setup>
const emit = defineEmits(['open-exit-modal'])
</script>

<template>
  <header class="bg-white shadow-xl px-4 py-6 sticky top-0 z-10">
    <div class="flex justify-between items-center w-full max-w-4xl mx-auto">
      <div>
        <span class="text-xl font-bold">Bring<span class="text-primary">Me</span></span>
      </div>
      <button
        @click="emit('open-exit-modal')"
        class="flex items-center gap-1 text-dark-gray-gray transition cursor-pointer text-dark-gray"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
          />
        </svg>
        Exit Game
      </button>
    </div>
  </header>
</template>
