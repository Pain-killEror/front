// Файл: js/admin-dashboard.js

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

async function loadAdminWidgetsData() {
    console.log("Загружаем данные для виджетов администратора...");
    const requestBody = {
        filters: { adminId: currentUser.id },
        widgetIds: ["roleStatistics", "userStatusOverview"]
    };
    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        if (analyticsData.widgets.roleStatistics) {
            renderRoleStatsChart(analyticsData.widgets.roleStatistics.data);
        }
        if (analyticsData.widgets.userStatusOverview) {
            renderUserStatusChart(analyticsData.widgets.userStatusOverview.data);
        }
        
    } catch (error) {
        console.error("Ошибка загрузки данных для виджетов администратора:", error);
    }
}

const CHART_WRAPPER_STYLE = 'position: relative; flex-grow: 1; min-height: 0; width: 100%; overflow: hidden;';

function renderRoleStatsChart(data) {
    const widget = document.getElementById('widget-role-stats');
    if (!widget) return;
    if (!data || data.length === 0) { widget.innerHTML = '<h3>Распределение персонала</h3><p>Нет данных для отображения.</p>'; return; }
    const roleTranslations = { 'ADMINISTRATOR': 'Администраторы', 'DEAN_STAFF': 'Сотрудники деканата', 'TEACHER': 'Преподаватели', 'STUDENT': 'Студенты', 'RECTORATE_STAFF': 'Сотрудники ректората' };
    widget.innerHTML = `<h3>Распределение персонала</h3><div style="${CHART_WRAPPER_STYLE}"><canvas id="roleStatsCanvas"></canvas></div>`;
    const canvas = document.getElementById('roleStatsCanvas');
    const labels = data.map(item => roleTranslations[item.label] || item.label);
    const userCounts = data.map(item => item.count);
    new Chart(canvas, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Количество', data: userCounts, backgroundColor: ['#007bff', '#6f42c1', '#28a745', '#17a2b8', '#6610f2'], borderWidth: 1, barPercentage: 0.5 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { type: 'logarithmic' } } } });
}

function renderUserStatusChart(data) {
    const widget = document.getElementById('widget-user-activity');
    if (!widget) return;
    if (!data || !Array.isArray(data) || data.length === 0) { widget.innerHTML = '<h3>Статистика по статусам</h3><p>Нет данных для отображения.</p>'; return; }
    const statusTranslations = { 'ACTIVE': 'Активные пользователи', 'PENDING': 'Ожидают подтверждения', 'BLOCKED': 'Заблокированные' };
    const statsHtml = data.map(item => { const label = statusTranslations[item.label] || item.label; return `<div class="status-item" data-status="${item.label}"><span class="status-label">${label}</span><span class="status-count">${item.count}</span></div>`; }).join('');
    widget.innerHTML = `<h3>Статистика по статусам</h3><div class="status-list">${statsHtml}</div>`;
}

