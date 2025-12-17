<script setup>
const emit = defineEmits(['logout'])
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-8 text-center">
    <h2 class="text-2xl font-bold text-dark-gray mb-2">Game Has Ended</h2>
    <p class="text-slate mb-6">
      This game has concluded. Thank you for participating! Winners will be contacted via Instagram
      and you can exit the game now.
    </p>
    <button
      @click="emit('logout')"
      class="px-6 py-3 bg-primary text-white font-semibold rounded-md hover:bg-primary/90 transition cursor-pointer"
    >
      Exit Game
    </button>
  </div>
</template>
