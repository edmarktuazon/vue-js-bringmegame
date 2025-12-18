<!-- eslint-disable vue/multi-word-component-names -->
<script setup>
defineProps({
  leaderboard: Array,
})
</script>

<template>
  <div class="bg-white rounded-lg shadow-sm p-6">
    <div class="flex items-center gap-2 mb-2">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 10V3L4 14h7v7l9-11h-7z"
        />
      </svg>
      <h2 class="text-lg font-semibold text-dark-gray">Fastest Submissions (Photos Unverified)</h2>
    </div>
    <p class="text-xs text-slate mb-4">Top 10 fastest players who completed all 3 prompts.</p>

    <div v-if="leaderboard.length === 0" class="py-8 text-center text-slate text-sm">
      No players have completed all 3 prompts yet.
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="entry in leaderboard"
        :key="entry.userId"
        class="flex items-center justify-between p-4 rounded-lg transition-all border"
        :class="{
          'bg-yellow-50 border-yellow-400 shadow-xl': entry.rank === 1,
          'bg-gray-100 border-gray-400 shadow-lg': entry.rank === 2,
          'bg-orange-50 border-orange-500 shadow-lg': entry.rank === 3,
          'bg-blue-50 border-blue-300 shadow': entry.rank >= 4,
        }"
      >
        <div class="flex items-center gap-4">
          <div class="flex-shrink-0">
            <div
              v-if="entry.rank === 1"
              class="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl"
            >
              1<sup>st</sup>
            </div>
            <div
              v-else-if="entry.rank === 2"
              class="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            >
              2<sup>nd</sup>
            </div>
            <div
              v-else-if="entry.rank === 3"
              class="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            >
              3<sup>rd</sup>
            </div>
            <div
              v-else
              class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
            >
              {{ entry.rank }}<sup>th</sup>
            </div>
          </div>
          <div>
            <p class="font-semibold text-dark-gray">{{ entry.instagramHandle }}</p>
            <p class="text-xs text-slate">Completed all 3 prompts</p>
          </div>
        </div>
        <div class="text-right">
          <p class="text-lg font-bold text-dark-gray">{{ entry.formattedTime }}</p>
          <p class="text-xs text-slate">completion time</p>
        </div>
      </div>
    </div>
  </div>
</template>
