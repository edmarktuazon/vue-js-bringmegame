<!-- eslint-disable vue/multi-word-component-names -->
<script setup>
defineProps({
  leaderboard: Array,
  liveLeaderboard: { type: Array, default: () => [] },
})
</script>

<template>
  <div class="space-y-6">
    <!-- Fastest submissions -->
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
        <h2 class="text-lg font-semibold text-dark-gray">Fastest Submissions</h2>
      </div>
      <p class="text-xs text-slate mb-4">Top 10 fastest players who completed all 3 prompts.</p>

      <div v-if="leaderboard.length === 0" class="py-8 text-center text-slate text-sm">
        There are currently no active players.
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="entry in leaderboard"
          :key="entry.userId"
          class="flex items-center justify-between p-4 rounded-lg transition-all border"
          :class="{
            'bg-yellow-50 border-yellow-400 shadow-xl': entry.rank === 1 && !entry.isDisqualified,
            'bg-gray-100 border-gray-400 shadow-lg': entry.rank === 2 && !entry.isDisqualified,
            'bg-orange-50 border-orange-500 shadow-lg': entry.rank === 3 && !entry.isDisqualified,
            'bg-blue-50 border-blue-300 shadow': entry.rank >= 4 && !entry.isDisqualified,
            'bg-gray-100 border-gray-300': entry.isDisqualified,
          }"
        >
          <div class="flex items-center gap-4">
            <div class="shrink-0">
              <div
                v-if="entry.rank === 1 && !entry.isDisqualified"
                class="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl"
              >
                1<sup>st</sup>
              </div>
              <div
                v-else-if="entry.rank === 2 && !entry.isDisqualified"
                class="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                2<sup>nd</sup>
              </div>
              <div
                v-else-if="entry.rank === 3 && !entry.isDisqualified"
                class="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                3<sup>rd</sup>
              </div>
              <div
                v-else-if="!entry.isDisqualified"
                class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                {{ entry.rank }}<sup>th</sup>
              </div>
              <div
                v-else
                class="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                {{ entry.rank }}<sup>{{ ['st', 'nd', 'rd'][entry.rank - 1] || 'th' }}</sup>
              </div>
            </div>
            <h3 class="font-semibold text-dark-gray break-all">
              {{ entry.instagramHandle }}
            </h3>
          </div>
          <div class="text-right">
            <p v-if="!entry.isDisqualified" class="text-lg font-bold text-dark-gray">
              {{ entry.formattedTime }}
            </p>
            <p
              class="text-xs"
              :class="entry.isDisqualified ? 'text-red-500 font-semibold' : 'text-slate'"
            >
              {{ entry.isDisqualified ? 'Disqualified' : 'completion time' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Live Leaderboard -->
    <div class="bg-white rounded-lg shadow-sm p-6">
      <div class="flex items-center gap-2 mb-2">
        <svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        <h2 class="text-lg font-semibold text-dark-gray">Live Leaderboard</h2>
        <span class="flex items-center gap-1 ml-1">
          <span class="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          <span class="text-xs text-green-600 font-medium">Live</span>
        </span>
      </div>
      <p class="text-xs text-slate mb-4">Current player rankings based on approved submissions.</p>

      <div v-if="liveLeaderboard.length === 0" class="py-8 text-center text-slate text-sm">
        No players ranked yet.
      </div>

      <div v-else class="space-y-3 max-h-96 overflow-y-auto">
        <div
          v-for="entry in liveLeaderboard"
          :key="entry.id"
          class="flex items-center justify-between p-4 rounded-lg border transition-all"
          :class="{
            'bg-yellow-50 border-yellow-400 shadow-xl': entry.rank === 1 && !entry.isDisqualified,
            'bg-gray-100 border-gray-400 shadow-lg': entry.rank === 2 && !entry.isDisqualified,
            'bg-orange-50 border-orange-500 shadow-lg': entry.rank === 3 && !entry.isDisqualified,
            'bg-blue-50 border-blue-300 shadow': entry.rank >= 4 && !entry.isDisqualified,
            'bg-gray-100 border-gray-300': entry.isDisqualified,
          }"
        >
          <div class="flex items-center gap-4">
            <div class="shrink-0">
              <div
                v-if="entry.rank === 1 && !entry.isDisqualified"
                class="w-14 h-14 bg-yellow-500 rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl"
              >
                1<sup>st</sup>
              </div>
              <div
                v-else-if="entry.rank === 2 && !entry.isDisqualified"
                class="w-12 h-12 bg-gray-500 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                2<sup>nd</sup>
              </div>
              <div
                v-else-if="entry.rank === 3 && !entry.isDisqualified"
                class="w-12 h-12 bg-orange-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                3<sup>rd</sup>
              </div>
              <div
                v-else-if="!entry.isDisqualified"
                class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                {{ entry.rank }}<sup>th</sup>
              </div>
              <div
                v-else
                class="w-12 h-12 bg-gray-400 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
              >
                {{ entry.rank }}<sup>{{ ['st', 'nd', 'rd'][entry.rank - 1] || 'th' }}</sup>
              </div>
            </div>
            <span
              class="font-semibold break-all"
              :class="entry.isDisqualified ? 'text-gray-400' : 'text-dark-gray'"
            >
              {{ entry.handle }}
            </span>
          </div>
          <div class="text-right">
            <template v-if="entry.isDisqualified">
              <p class="text-xs text-red-500 font-semibold">Disqualified</p>
            </template>
            <template v-else>
              <p class="text-sm font-bold text-dark-gray">{{ entry.approvedCount }} approved</p>
            </template>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
