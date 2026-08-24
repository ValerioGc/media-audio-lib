<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import { closeMiniPlayer } from '@/services/shell-integration';
import { closeWindow, quitApp } from '@/services/window-controls';
import { useSettingsStore } from '@/stores/settings';

const { t } = useI18n();
const settings = useSettingsStore();
const remembers = ref(false);
const isSending = ref(false);

onMounted(() => {
  settings.initialize().catch((error: unknown) => {
    console.error('Loading settings for the close question failed', error);
  });
});

onBeforeUnmount(() => {
  settings.dispose();
});

async function cancel() {
  await closeWindow();
}

async function choose(quitsApp: boolean) {
  if (isSending.value) {
    return;
  }

  isSending.value = true;

  try {
    if (remembers.value) {
      await settings.setMiniPlayerCloseAction(quitsApp ? 'app' : 'dock');
    }

    // The confirmation window owns the decision and closes the target directly. This avoids
    // losing the click when the mini-player event listener is still being attached.
    if (quitsApp) {
      await quitApp();
    } else {
      await closeMiniPlayer();
    }
  } catch (error) {
    console.error('Applying the close choice failed', error);
  } finally {
    await closeWindow();
    isSending.value = false;
  }
}
</script>

<template>
  <main class="mini_confirm" aria-labelledby="mini-confirm-title">
    <section class="mini_confirm_panel" role="dialog" aria-modal="true">
      <h1 id="mini-confirm-title" class="mini_confirm_title">{{ t('mini.confirm.title') }}</h1>
      <p class="mini_confirm_message">{{ t('mini.confirm.message') }}</p>

      <label class="mini_confirm_remember">
        <input v-model="remembers" type="checkbox" data-testid="mini-confirm-remember" />
        <span>{{ t('mini.confirm.remember') }}</span>
      </label>

      <footer class="mini_confirm_actions">
        <AppButton
          variant="ghost"
          data-testid="mini-confirm-cancel"
          :disabled="isSending"
          @click="cancel"
        >
          {{ t('mini.confirm.cancel') }}
        </AppButton>
        <AppButton data-testid="mini-confirm-dock" :disabled="isSending" @click="choose(false)">
          {{ t('mini.confirm.dockOnly') }}
        </AppButton>
        <AppButton
          variant="danger"
          data-testid="mini-confirm-app"
          :disabled="isSending"
          @click="choose(true)"
        >
          {{ t('mini.confirm.wholeApp') }}
        </AppButton>
      </footer>
    </section>
  </main>
</template>

<style scoped lang="scss">
.mini_confirm {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100%;
  padding: $space_lg;
  background-color: var(--color_bg);
  color: var(--color_text);

  &_panel {
    display: flex;
    flex-direction: column;
    gap: $space_md;
    width: min(26rem, 100%);
    padding: $space_lg;
    @include surface_panel($radius_lg);
    box-shadow: var(--shadow_raised);
  }

  &_title {
    font-size: 1.125em;
    font-weight: 600;
  }

  &_message {
    color: var(--color_text_muted);
    line-height: 1.45;
  }

  &_remember {
    display: flex;
    gap: $space_sm;
    align-items: center;
    cursor: pointer;

    input {
      width: 1rem;
      height: 1rem;
      accent-color: var(--color_accent);
    }
  }

  &_actions {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm;
    justify-content: flex-end;
  }
}
</style>
