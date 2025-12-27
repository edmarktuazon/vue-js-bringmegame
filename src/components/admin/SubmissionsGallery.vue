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

const emit = defineEmits(['update:selectedUser', 'submission-updated'])

const localSelectedUser = ref(props.selectedUser)

//  Modal state
const showModal = ref(false)
const selectedSubmission = ref(null)

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

// Open modal
const openModal = (submission) => {
  selectedSubmission.value = submission
  showModal.value = true
  // Prevent body scroll
  document.body.style.overflow = 'hidden'
}

// Close modal
const closeModal = () => {
  showModal.value = false
  selectedSubmission.value = null
  // Restore body scroll
  document.body.style.overflow = ''
}

// Close on escape key
const handleKeydown = (e) => {
  if (e.key === 'Escape' && showModal.value) {
    closeModal()
  }
}

// Add event listener for Escape key
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', handleKeydown)
}

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

    // Update modal if open
    if (selectedSubmission.value?.id === submission.id) {
      selectedSubmission.value = { ...selectedSubmission.value, status: 'approved' }
    }
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

    // Update modal if open
    if (selectedSubmission.value?.id === submission.id) {
      selectedSubmission.value = { ...selectedSubmission.value, status: 'rejected' }
    }
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

    <!-- Empty state -->
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

    <!-- Submissions grid -->
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

        <div
          @click="openModal(sub)"
          class="relative cursor-pointer group overflow-hidden rounded-md"
        >
          <img
            :src="sub.photoUrl"
            alt="Submission"
            class="w-full h-52 object-cover transition-transform duration-300 group-hover:scale-105"
          />
          <!-- Hover overlay -->
          <div
            class="absolute inset-0 bg-opacity-0 group-hover:bg-opacity-30 transition-all duration-300 flex items-center justify-center"
          >
            <svg
              class="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
              />
            </svg>
          </div>
        </div>

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

        <div
          v-else-if="isCurrentGameSubmission(sub)"
          class="mt-4 text-center text-sm font-medium flex items-center gap-3"
        >
          <span class="text-sm font-medium text-slate">Status:</span>
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

  <!-- Modal -->
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="showModal && selectedSubmission"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-75"
        @click.self="closeModal"
      >
        <div
          class="relative bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto shadow-2xl"
        >
          <!-- Close button -->
          <button
            @click="closeModal"
            class="absolute top-4 right-4 z-10 bg-black bg-opacity-50 hover:bg-opacity-70 text-white rounded-full p-2 transition-all cursor-pointer"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          <!-- Image -->
          <div>
            <img
              :src="selectedSubmission.photoUrl"
              :alt="`${selectedSubmission.instagramHandle} - Prompt ${selectedSubmission.promptIndex + 1}`"
              class="w-full max-h-[60vh] object-contain"
            />
          </div>

          <!-- Details -->
          <div class="p-6 space-y-4">
            <div>
              <h3 class="text-2xl font-bold text-primary mb-2">
                {{ selectedSubmission.instagramHandle }}
              </h3>
              <p class="text-lg text-dark-gray">
                <span class="font-semibold">Prompt {{ selectedSubmission.promptIndex + 1 }}:</span>
                <span class="ml-2 italic">{{ getPromptText(selectedSubmission.promptIndex) }}</span>
              </p>
              <p class="text-sm text-slate mt-2">
                Uploaded:
                {{ selectedSubmission.uploadedAt?.toDate?.().toLocaleString() || 'Just now' }}
              </p>
            </div>

            <!-- Status badge -->
            <div class="flex items-center gap-3">
              <span class="text-sm font-medium text-slate">Status:</span>
              <span
                class="px-4 py-1.5 rounded-full text-white text-sm font-medium"
                :class="{
                  'bg-yellow-500': selectedSubmission.status === 'pending',
                  'bg-green-600': selectedSubmission.status === 'approved',
                  'bg-red-600': selectedSubmission.status === 'rejected',
                }"
              >
                {{
                  selectedSubmission.status.charAt(0).toUpperCase() +
                  selectedSubmission.status.slice(1)
                }}
              </span>
            </div>

            <!-- Action buttons -->
            <div
              v-if="
                isCurrentGameSubmission(selectedSubmission) &&
                selectedSubmission.status === 'pending'
              "
              class="flex gap-4 pt-4 border-t border-light"
            >
              <button
                @click="handleApproveSubmission(selectedSubmission)"
                class="flex-1 bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 cursor-pointer transition font-medium text-lg"
              >
                Approve
              </button>
              <button
                @click="handleRejectSubmission(selectedSubmission)"
                class="flex-1 bg-red-600 text-white py-3 rounded-lg hover:bg-red-700 cursor-pointer transition font-medium text-lg"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .relative,
.modal-leave-active .relative {
  transition: transform 0.3s ease;
}

.modal-enter-from .relative,
.modal-leave-to .relative {
  transform: scale(0.9);
}
</style>
