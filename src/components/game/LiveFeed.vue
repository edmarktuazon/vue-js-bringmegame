<script setup>
defineProps({
  liveFeed: Array,
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex items-center gap-2 mb-4">
      <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
        />
      </svg>
      <h3 class="font-semibold text-dark-gray">Live Feed</h3>
    </div>

    <p class="text-xs text-slate mb-4">Users who have joined the game.</p>
    <div v-if="liveFeed.length === 0" class="text-center py-8 text-slate text-sm">
      No users yet.
    </div>
    <div v-else class="space-y-2 max-h-96 overflow-y-auto">
      <div
        v-for="feedUser in liveFeed"
        :key="feedUser.id"
        class="flex items-center gap-2 p-2 bg-soft rounded-md"
      >
        <div class="w-8 h-8 bg-primary/20 rounded-full flex items-center justify-center">
          <span class="text-primary font-bold text-xs">
            {{ feedUser.instagramHandle.charAt(1).toUpperCase() }}
          </span>
        </div>
        <span class="text-sm text-dark-gray">{{ feedUser.instagramHandle }}</span>
      </div>
    </div>
  </div>
</template>
