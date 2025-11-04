

<template>
  <div class="dashboard-container">
    <!-- Динамически отображаем компонент панели для текущей роли -->
    <component :is="dashboardForCurrentRole" />
  </div>
</template>

<script setup>
import { computed, defineAsyncComponent } from 'vue';
// Предполагается, что у вас есть store (Pinia/Vuex), где хранится информация о пользователе
import { useAuthStore } from '@/stores/auth'; 

const authStore = useAuthStore();

// Это вычисляемое свойство определяет, какой компонент нужно показать
const dashboardForCurrentRole = computed(() => {
  // Убедимся, что пользователь загружен
  if (!authStore.user || !authStore.user.role) {
    return null; // Можно показать компонент-загрузчик
  }

  switch (authStore.user.role) {
    case 'ADMINISTRATOR':
      // Асинхронная загрузка для лучшей производительности
      return defineAsyncComponent(() => import('./dashboard/AdminDashboard.vue'));
    case 'STUDENT':
      return defineAsyncComponent(() => import('./dashboard/StudentDashboard.vue'));
    // Здесь можно будет добавить другие роли в будущем
    // case 'TEACHER':
    //   return defineAsyncComponent(() => import('./dashboard/TeacherDashboard.vue'));
    default:
      // Компонент-заглушка на случай, если роль не определена
      return defineAsyncComponent(() => import('@/components/common/NotFoundDashboard.vue')); 
  }
});
</script>

<style scoped>
.dashboard-container {
  padding: 1rem;
}
</style>