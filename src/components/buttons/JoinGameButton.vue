<script setup>
defineProps({
  label: {
    type: String,
    default: 'Join',
  },
})
</script>

<template>
  <button
    class="w-full bg-primary text-white font-semibold py-3 rounded-md transition-colors cursor-pointer hover:bg-primary/90 focus:outline focus:outline-2 focus:outline-primary"
  >
    {{ label }}
  </button>
</template>
