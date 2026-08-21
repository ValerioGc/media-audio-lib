<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/AppButton.vue';
import AppInput from '@/components/common/AppInput.vue';
import { useLibraryStore } from '@/stores/library';

const { t } = useI18n();
const library = useLibraryStore();

const name = ref('');

onMounted(async () => {
  await library.loadLibraries();
});

async function create() {
  if (await library.createLibrary(name.value)) {
    name.value = '';
  }
}
</script>

<template>
  <form class="library_create_form" @submit.prevent="create">
    <AppInput
      v-model="name"
      :label="t('library.catalog.create.label')"
      :placeholder="t('library.catalog.create.placeholder')"
    />
    <AppButton type="submit" variant="primary" data-testid="create-library">
      {{ t('library.catalog.create.submit') }}
    </AppButton>
  </form>
</template>

<style scoped lang="scss">
.library_create_form {
  display: flex;
  gap: $space_sm;
  align-items: flex-end;
}
</style>
