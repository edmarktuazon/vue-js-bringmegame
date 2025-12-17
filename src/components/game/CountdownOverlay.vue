<script setup>
defineProps({
  countdown: Number,
})
</script>

<template>
  <div class="flex items-center justify-center min-h-[60vh]">
    <div class="bg-white rounded-lg shadow-2xl p-12 text-center max-w-md w-full">
      <h2 class="text-3xl font-bold text-dark-gray mb-4">Get Ready!</h2>
      <p class="text-slate mb-8">The game is about to begin...</p>

      <div class="relative w-48 h-48 mx-auto mb-6">
        <svg class="transform -rotate-90 w-48 h-48">
          <circle cx="96" cy="96" r="88" stroke="#f3f4f6" stroke-width="8" fill="none" />
          <circle
            cx="96"
            cy="96"
            r="88"
            :stroke="countdown <= 5 ? '#ef4444' : '#8b5cf6'"
            stroke-width="8"
            fill="none"
            :stroke-dasharray="552.92"
            :stroke-dashoffset="552.92 - (552.92 * countdown) / 30"
            class="transition-all duration-1000 ease-linear"
          />
        </svg>

        <div class="absolute inset-0 flex items-center justify-center">
          <span
            :class="[
              'text-7xl font-bold transition-all duration-300',
              countdown <= 5 ? 'text-red-500 scale-110' : 'text-primary',
            ]"
          >
            {{ countdown }}
          </span>
        </div>
      </div>

      <p class="text-sm text-slate">Prepare your camera and get ready to hunt for items!</p>
    </div>
  </div>
</template>
