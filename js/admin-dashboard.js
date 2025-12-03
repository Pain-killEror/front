// Файл: js/admin-dashboard.js

/**
* Главная функция инициализации панели администратора.
*/
async function initAdminDashboard() {
    try {
        const response = await fetch('templates/admin-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для администратора');
        const templateHtml = await response.text();

        document.getElementById('dashboard-content').innerHTML = templateHtml;

        await loadAdminWidgetsData();
    } catch (error) {
        console.error("Ошибка при инициализации панели администратора:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса администратора.</p></div>';
    }
}

/**
* Загрузка данных для всех виджетов администратора.
*/
async function loadAdminWidgetsData() {
    console.log("Загружаем данные для виджетов администратора...");
    
    const requestBody = {
        filters: {
            adminId: currentUser.id 
        },
        widgetIds: [
            "roleStatistics",
            "userStatusOverview",
            "latestActions",
            "registrationDynamics"
        ]
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        if (analyticsData.widgets.roleStatistics) {
            renderRoleStatsChart(analyticsData.widgets.roleStatistics.data);
        }
        if (analyticsData.widgets.userStatusOverview) {
            renderUserStatusChart(analyticsData.widgets.userStatusOverview.data);
        }
        if (analyticsData.widgets.latestActions) {
            renderLatestActions(analyticsData.widgets.latestActions.data);
        }
        if (analyticsData.widgets.registrationDynamics) {
            renderRegistrationDynamicsChart(analyticsData.widgets.registrationDynamics.data);
        }

    } catch (error) {
        console.error("Ошибка загрузки данных для виджетов администратора:", error);
    }
}

// --- ФУНКЦИИ РЕНДЕРИНГА ---

// Вспомогательный стиль для обертки графика, чтобы он не растягивался бесконечно
const CHART_WRAPPER_STYLE = 'position: relative; flex-grow: 1; min-height: 0; width: 100%; overflow: hidden;';

/**
* 1. Рендеринг "Распределение по ролям"
*/
function renderRoleStatsChart(data) {
    const widget = document.getElementById('widget-role-stats');
    if (!widget) return;

    if (!data || data.length === 0) {
        widget.innerHTML = '<h3>Распределение по ролям</h3><p>Нет данных для отображения.</p>';
        return;
    }

    // ИЗМЕНЕНИЕ: Оборачиваем canvas в div с жесткими стилями
    widget.innerHTML = `
        <h3>Распределение по ролям</h3>
        <div style="${CHART_WRAPPER_STYLE}">
            <canvas id="roleStatsCanvas"></canvas>
        </div>`;

    const canvas = document.getElementById('roleStatsCanvas');
    const labels = data.map(item => item.label);
    const userCounts = data.map(item => item.count);

    new Chart(canvas, {
        type: 'pie',
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
            maintainAspectRatio: false, // Важно: разрешаем графику менять пропорции
            plugins: {
                legend: {
                    position: 'right',
                }
            }
        }
    });
}

/**
* 2. Рендеринг "Статус пользователей" (Именно тут была проблема с растягиванием)
*/
function renderUserStatusChart(data) {
    const widget = document.getElementById('widget-user-activity');
    if (!widget) return;

    if (!data || data.length === 0) {
        widget.innerHTML = '<h3>Активность пользователей</h3><p>Нет данных для отображения.</p>';
        return;
    }

    // ИЗМЕНЕНИЕ: Оборачиваем canvas в div
    widget.innerHTML = `
        <h3>Активность пользователей</h3>
        <div style="${CHART_WRAPPER_STYLE}">
            <canvas id="userStatusCanvas"></canvas>
        </div>`;

    const canvas = document.getElementById('userStatusCanvas');
    const labels = data.map(item => item.label);
    const counts = data.map(item => item.count);

    new Chart(canvas, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Количество пользователей',
                data: counts,
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)', // ACTIVE
                    'rgba(255, 206, 86, 0.8)', // PENDING
                    'rgba(255, 99, 132, 0.8)'  // BLOCKED
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // Важно
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

/**
* 3. Рендеринг "Последние действия"
*/
function renderLatestActions(data) {
    const widget = document.getElementById('widget-recent-actions');
    if (!widget) return;

    let listHtml = '<h3>Последние действия</h3>';
    
    if (!data || data.length === 0) {
        listHtml += '<p>Нет недавних действий.</p>';
    } else {
        // Добавляем overflow-y для скролла списка
        listHtml += '<ul style="list-style: none; padding: 0; margin: 0; overflow-y: auto; flex-grow: 1;">';
        data.forEach(log => {
            const date = new Date(log.createdAt).toLocaleString();
            const userName = log.userLogin || 'System'; // Используем userLogin из DTO
            
            listHtml += `<li style="border-bottom: 1px solid #eee; padding: 8px 0;">
                <strong style="color: #007bff;">${log.actionType}</strong> 
                (Пользователь: ${userName})
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
*/
function renderRegistrationDynamicsChart(data) {
    const widget = document.getElementById('widget-system-status');
    if (!widget) return;

    if (!data || data.length === 0) {
        widget.innerHTML = '<h3>Динамика регистраций (7 дней)</h3><p>Нет данных для отображения.</p>';
        return;
    }

    // ИЗМЕНЕНИЕ: Оборачиваем canvas в div
    widget.innerHTML = `
        <h3>Динамика регистраций (7 дней)</h3>
        <div style="${CHART_WRAPPER_STYLE}">
            <canvas id="regDynamicsCanvas"></canvas>
        </div>`;

    const canvas = document.getElementById('regDynamicsCanvas');
    const labels = data.map(item => item.label);
    const counts = data.map(item => item.count);

    new Chart(canvas, {
        type: 'line',
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
            maintainAspectRatio: false, // Важно
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1 // Шаг шкалы целые числа
                    }
                }
            }
        }
    });
}