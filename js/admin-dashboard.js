// Файл: js/admin-dashboard.js
// Этот файл содержит ВСЮ логику, необходимую для работы панели администратора.
// Он был обновлен для работы с существующим AnalyticsService.

/**
 * Главная функция, которую будет вызывать наш диспетчер dashboard.js [cite: 628]
 */
async function initAdminDashboard() {
  // 1. Загружаем HTML-шаблон для администратора
  try {
    const response = await fetch('templates/admin-dashboard.html'); 
    if (!response.ok) throw new Error('Не удалось загрузить шаблон для администратора'); 
    const templateHtml = await response.text(); 
    
    // 2. Вставляем HTML в главный контейнер
    document.getElementById('dashboard-content').innerHTML = templateHtml; 
    
    // 3. Запускаем загрузку данных для всех виджетов администратора
    await loadAdminWidgetsData();
  } catch (error) {
    console.error("Ошибка при инициализации панели администратора:", error); 
    document.getElementById('dashboard-content').innerHTML =
        '<div class="widget"><p>Произошла ошибка при загрузке интерфейса администратора.</p></div>';
  }
}

/**
 * Эта функция будет запрашивать данные для ВСЕХ виджетов администратора
 * через универсальный эндпоинт /api/analytics/query.
 */
async function loadAdminWidgetsData() {
  console.log("Загружаем данные для виджетов администратора...");

  // Готовим запрос к универсальному эндпоинту аналитики 
  const requestBody = {
    filters: {
      // Используем глобальную переменную currentUser из dashboard.js [cite: 622]
      adminId: currentUser.id // Это "триггер" для вызова calculateAdminWidgetData в сервисе [cite: 1246]
    },
    widgetIds: [
      "roleStatistics",         // [cite: 1253, 1287]
      "userStatusOverview",     // [cite: 1254, 1288]
      "latestActions",          // [cite: 1254, 1289]
      "registrationDynamics"    // [cite: 1254, 1290]
      // Для "widget-pending-users" [cite: 690] на бэкенде логика пока не реализована
    ]
  };

  try {
    // Используем POST-запрос, как в 
    const analyticsData = await request('/analytics/query', 'POST', requestBody); 

    // 4. Отрисовываем каждый виджет, вставляя данные в placeholder'ы из
    // admin-dashboard.html [cite: 687-690]

    // Виджет "Распределение по ролям"
    if (analyticsData.widgets.roleStatistics) {
      renderRoleStatsChart(analyticsData.widgets.roleStatistics.data);
    }

    // Виджет "Статус пользователей" (вставляем в 'widget-user-activity')
    if (analyticsData.widgets.userStatusOverview) {
      renderUserStatusChart(analyticsData.widgets.userStatusOverview.data);
    }

    // Виджет "Последние действия"
    if (analyticsData.widgets.latestActions) {
      renderLatestActions(analyticsData.widgets.latestActions.data);
    }

    // Виджет "Динамика регистраций" (вставляем в 'widget-system-status')
    if (analyticsData.widgets.registrationDynamics) {
      renderRegistrationDynamicsChart(analyticsData.widgets.registrationDynamics.data);
    }

  } catch (error) {
    console.error("Ошибка загрузки данных для виджетов администратора:", error);
  }
}

// --- ФУНКЦИИ РЕНДЕРИНГА ---

/**
 * 1. Рендеринг "Распределение по ролям" (адаптировано из [cite: 604-609])
 * @param {Array} data - Данные из analyticsData.widgets.roleStatistics.data
 */
function renderRoleStatsChart(data) {
  const widget = document.getElementById('widget-role-stats'); // [cite: 688]
  if (!widget || !data || data.length === 0) {
    widget.innerHTML = '<h3>Распределение по ролям</h3><p>Нет данных для отображения.</p>';
    return;
  }

  // Очищаем виджет от заглушки "Загрузка..."
  widget.innerHTML = '<h3>Распределение по ролям</h3><canvas id="roleStatsCanvas"></canvas>';
  const canvas = document.getElementById('roleStatsCanvas');

  // Готовим данные для Chart.js, используя DTO [cite: 1088-1089]
  const labels = data.map(item => item.label);
  const userCounts = data.map(item => item.count);

  new Chart(canvas, {
    type: 'pie', // Тип диаграммы - круговая
    data: {
      labels: labels,
      datasets: [{
        label: 'Количество пользователей',
        data: userCounts,
        backgroundColor: [
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 99, 132, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)',
        ],
        borderColor: 'rgba(255, 255, 255, 0.7)',
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false, 
      plugins: {
        legend: {
          position: 'right', // Легенда (подписи) справа
        }
      }
    }
  });
}

/**
 * 2. Рендеринг "Статус пользователей"
 * @param {Array} data - Данные из analyticsData.widgets.userStatusOverview.data
 */
function renderUserStatusChart(data) {
  const widget = document.getElementById('widget-user-activity'); // [cite: 688]
  if (!widget || !data || data.length === 0) {
    widget.innerHTML = '<h3>Активность пользователей (Статус)</h3><p>Нет данных для отображения.</p>';
    return;
  }

  widget.innerHTML = '<h3>Активность пользователей (Статус)</h3><canvas id="userStatusCanvas"></canvas>';
  const canvas = document.getElementById('userStatusCanvas');
  
  // [cite: 1088-1089]
  const labels = data.map(item => item.label);
  const counts = data.map(item => item.count);

  new Chart(canvas, {
    type: 'bar', // Бэкенд рекомендует BAR_CHART [cite: 1288]
    data: {
      labels: labels,
      datasets: [{
        label: 'Количество пользователей',
        data: counts,
        backgroundColor: [
          'rgba(75, 192, 192, 0.8)',  // ACTIVE
          'rgba(255, 206, 86, 0.8)', // PENDING
          'rgba(255, 99, 132, 0.8)'   // BLOCKED
        ],
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // Не нужна для одной полосы
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

/**
 * 3. Рендеринг "Последние действия"
 * @param {Array} data - Данные из analyticsData.widgets.latestActions.data
 */
function renderLatestActions(data) {
  const widget = document.getElementById('widget-recent-actions'); // [cite: 688]
  if (!widget || !data) {
    widget.innerHTML = '<h3>Последние действия</h3><p>Нет данных для отображения.</p>';
    return;
  }

  let listHtml = '<h3>Последние действия</h3>';
  if (data.length === 0) {
    listHtml += '<p>Нет недавних действий.</p>';
  } else {
    // В base.css нет стилей для этого, но семантически это правильно
    listHtml += '<ul style="list-style: none; padding: 0; max-height: 300px; overflow-y: auto;">'; 
    data.forEach(log => {
      // Структура лога из [cite: 1171-1175]
      const date = new Date(log.createdAt).toLocaleString();
      const userName = log.user ? log.user.login : 'System';
      listHtml += `<li style="border-bottom: 1px solid #eee; padding: 8px 0;">
          <strong style="color: #007bff;">${log.actionType}</strong> (Пользователь: ${userName})
          <p style="margin: 4px 0 0; font-size: 0.9rem;">${log.description}</p>
          <span style="font-size: 0.8rem; color: #6c757d;">${date}</span>
      </li>`;
    });
    listHtml += '</ul>';
  }
  widget.innerHTML = listHtml;
}

/**
 * 4. Рендеринг "Динамика регистраций"
 * @param {Array} data - Данные из analyticsData.widgets.registrationDynamics.data
 */
function renderRegistrationDynamicsChart(data) {
  const widget = document.getElementById('widget-system-status'); // [cite: 689]
  if (!widget || !data || data.length === 0) {
    widget.innerHTML = '<h3>Динамика регистраций (7 дней)</h3><p>Нет данных для отображения.</p>';
    return;
  }

  widget.innerHTML = '<h3>Динамика регистраций (7 дней)</h3><canvas id="regDynamicsCanvas"></canvas>';
  const canvas = document.getElementById('regDynamicsCanvas');
  
  // [cite: 1088-1089]
  const labels = data.map(item => item.label);
  const counts = data.map(item => item.count);

  new Chart(canvas, {
    type: 'line', // Бэкенд рекомендует LINE_CHART [cite: 1290]
    data: {
      labels: labels,
      datasets: [{
        label: 'Новые регистрации',
        data: counts,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        fill: true,
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}