<script setup>
import { computed, ref, watch } from 'vue'
import { updateSubmissionStatus } from '/firebase/gameHelpers'
import { auth } from '/firebase/config'

const props = defineProps({
  currentGame: { type: Object, default: null },
  allSubmissions: { type: Array, default: () => [] },
  users: { type: Array, default: () => ['All Users'] },
  selectedUser: { type: String, default: 'All Users' },
})

const emit = defineEmits([
  'update:selectedUser',
  'submission-updated', // Notify parent of status change
])

const localSelectedUser = ref(props.selectedUser)

watch(
  () => props.selectedUser,
  (newVal) => {
    localSelectedUser.value = newVal
  },
)

watch(localSelectedUser, (newVal) => {
  emit('update:selectedUser', newVal)
})

const activeTab = ref('pending')

const getPromptText = (index) => {
  if (!props.currentGame?.prompts || !Array.isArray(props.currentGame.prompts)) {
    return `Prompt ${index + 1}`
  }
  return props.currentGame.prompts[index] || `Prompt ${index + 1} (Missing)`
}

const currentSubmissions = computed(() => {
  if (!props.currentGame?.id) return []

  let subs = props.allSubmissions.filter((s) => s.gameId === props.currentGame.id)

  if (localSelectedUser.value !== 'All Users') {
    subs = subs.filter((s) => s.instagramHandle === localSelectedUser.value)
  }

  switch (activeTab.value) {
    case 'pending':
      subs = subs.filter((s) => s.status === 'pending')
      break
    case 'approved':
      subs = subs.filter((s) => s.status === 'approved')
      break
    case 'rejected':
      subs = subs.filter((s) => s.status === 'rejected')
      break
  }

  return subs.sort((a, b) => (b.uploadedAt?.toMillis?.() || 0) - (a.uploadedAt?.toMillis?.() || 0))
})

const submissionCounts = computed(() => {
  if (!props.currentGame?.id) return { pending: 0, approved: 0, rejected: 0 }

  const currentSubs = props.allSubmissions.filter((s) => s.gameId === props.currentGame.id)

  return {
    pending: currentSubs.filter((s) => s.status === 'pending').length,
    approved: currentSubs.filter((s) => s.status === 'approved').length,
    rejected: currentSubs.filter((s) => s.status === 'rejected').length,
  }
})

const isCurrentGameSubmission = (sub) => sub.gameId === props.currentGame?.id

const handleApproveSubmission = async (submission) => {
  if (!props.currentGame || !isCurrentGameSubmission(submission)) return

  emit('submission-updated', { submissionId: submission.id, newStatus: 'approved' })

  try {
    await updateSubmissionStatus(
      props.currentGame.id,
      submission.id,
      'approved',
      auth.currentUser?.email || 'admin',
    )
  } catch (error) {
    alert('Failed to approve: ' + (error.message || 'Unknown error'))
    emit('submission-updated', { submissionId: submission.id, newStatus: 'pending' })
  }
}

const handleRejectSubmission = async (submission) => {
  if (!props.currentGame || !isCurrentGameSubmission(submission)) return

  emit('submission-updated', { submissionId: submission.id, newStatus: 'rejected' })

  try {
    await updateSubmissionStatus(
      props.currentGame.id,
      submission.id,
      'rejected',
      auth.currentUser?.email || 'admin',
    )
  } catch (error) {
    alert('Failed to reject: ' + (error.message || 'Unknown error'))
    emit('submission-updated', { submissionId: submission.id, newStatus: 'pending' })
  }
}
</script>

<template>
  <div
    class="bg-white rounded-lg shadow-sm p-6"
    style="max-height: calc(100vh - 200px); overflow-y: auto"
  >
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <svg class="w-auto h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h2 class="text-lg font-semibold text-dark-gray">All Photo Submissions</h2>
      </div>

      <div>
        <label class="block text-xs text-slate mb-1">Filter by User</label>
        <select
          v-model="localSelectedUser"
          class="px-4 py-2 bg-soft text-sm rounded-md border-0 focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
        >
          <option v-for="user in users" :key="user" :value="user" class="cursor-pointer">
            {{ user === 'All Users' ? 'All Users' : user }}
          </option>
        </select>
      </div>
    </div>

    <p class="text-xs text-slate mb-4">Only current game submissions can be reviewed.</p>

    <!-- Tabs -->
    <div class="flex gap-4 border-b border-light mb-6">
      <button
        class="cursor-pointer"
        @click="activeTab = 'pending'"
        :class="
          activeTab === 'pending'
            ? 'border-b-2 border-dark text-dark-gray font-medium'
            : 'text-slate'
        "
      >
        Pending ({{ submissionCounts.pending }})
      </button>
      <button
        class="cursor-pointer"
        @click="activeTab = 'approved'"
        :class="
          activeTab === 'approved'
            ? 'border-b-2 border-dark text-dark-gray font-medium'
            : 'text-slate'
        "
      >
        Approved ({{ submissionCounts.approved }})
      </button>
      <button
        class="cursor-pointer"
        @click="activeTab = 'rejected'"
        :class="
          activeTab === 'rejected'
            ? 'border-b-2 border-dark text-dark-gray font-medium'
            : 'text-slate'
        "
      >
        Rejected ({{ submissionCounts.rejected }})
      </button>
    </div>

    <!-- Empty State -->
    <div v-if="currentSubmissions.length === 0" class="py-12 text-center">
      <svg
        class="w-12 h-12 text-slate mx-auto mb-3"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p class="text-slate text-sm">No {{ activeTab }} submissions found.</p>
    </div>

    <!-- Submissions Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="sub in currentSubmissions"
        :key="`${sub.gameId}_${sub.id}`"
        class="border border-light rounded-lg p-4 bg-white"
      >
        <div class="space-y-1 mb-3">
          <h3 class="font-bold text-primary">{{ sub.instagramHandle }}</h3>
          <p class="text-sm text-dark-gray">
            <span class="font-medium">Prompt {{ sub.promptIndex + 1 }}:</span>
            <span class="ml-1 italic font-medium">{{ getPromptText(sub.promptIndex) }}</span>
          </p>
          <p class="text-xs text-slate">
            Uploaded: {{ sub.uploadedAt?.toDate?.().toLocaleString() || 'Just now' }}
          </p>
        </div>

        <img :src="sub.photoUrl" alt="Submission" class="w-full h-52 object-cover rounded-md" />

        <div
          v-if="isCurrentGameSubmission(sub) && sub.status === 'pending'"
          class="flex gap-3 mt-4"
        >
          <button
            @click="handleApproveSubmission(sub)"
            class="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700 cursor-pointer transition"
          >
            Approve
          </button>
          <button
            @click="handleRejectSubmission(sub)"
            class="flex-1 bg-red-600 text-white py-2 rounded hover:bg-red-700 cursor-pointer transition"
          >
            Reject
          </button>
        </div>

        <!-- Optional: Show status if already reviewed -->
        <div v-else-if="isCurrentGameSubmission(sub)" class="mt-4 text-center text-sm font-medium">
          <span
            class="px-3 py-1 rounded-full text-white"
            :class="{
              'bg-green-600': sub.status === 'approved',
              'bg-red-600': sub.status === 'rejected',
            }"
          >
            {{ sub.status.charAt(0).toUpperCase() + sub.status.slice(1) }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
