<script setup lang="ts">
import { EMOTE_COOLDOWN_MS, TABLE_EMOTES } from '~~/shared/play/emotes'
import type { TableEmote } from '~~/shared/play/emotes'

const emit = defineEmits<{
  send: [emote: TableEmote]
}>()

const open = shallowRef(false)
const coolingDown = shallowRef(false)
const root = ref<HTMLElement | null>(null)

onClickOutside(root, () => {
  open.value = false
})

function send(emote: TableEmote) {
  if (coolingDown.value) {
    return
  }
  emit('send', emote)
  open.value = false
  coolingDown.value = true
  setTimeout(() => {
    coolingDown.value = false
  }, EMOTE_COOLDOWN_MS)
}
</script>

<template>
  <div
    ref="root"
    class="relative"
  >
    <PlayRoundButton
      icon="i-lucide-smile-plus"
      label="Envoyer une réaction"
      :active="open"
      :class="coolingDown ? 'opacity-60' : ''"
      :aria-expanded="open"
      @click="!coolingDown && (open = !open)"
    />
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="-translate-y-1 scale-95 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute top-full right-0 z-50 mt-2 grid w-max grid-cols-4 gap-1 rounded-xl table-menu p-1.5"
        role="menu"
      >
        <button
          v-for="emote in TABLE_EMOTES"
          :key="emote"
          type="button"
          role="menuitem"
          class="grid size-11 place-items-center rounded-lg text-[26px] leading-none transition hover:bg-white/10 active:scale-90"
          :aria-label="`Envoyer ${emote}`"
          @click="send(emote)"
        >
          {{ emote }}
        </button>
      </div>
    </Transition>
  </div>
</template>
