<script setup>
defineProps({
  submissions: Object,
})
</script>

<template>
  <div class="my-12">
    <p class="text-xs text-slate font-medium mb-2">Your uploaded photos:</p>
    <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
      <div v-for="(sub, idx) in submissions" :key="idx" class="relative">
        <img
          :src="sub.photoUrl"
          :alt="`Prompt ${sub.promptIndex + 1}`"
          class="w-full h-54 object-cover rounded-md"
        />
        <div class="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-0.5 rounded">
          Prompt {{ sub.promptIndex + 1 }}
        </div>
      </div>
    </div>
  </div>
</template>
