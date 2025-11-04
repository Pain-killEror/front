// Файл: js/rectorate-dashboard.js
// Содержит логику для работы панели сотрудника ректората.

// Глобальные переменные для хранения экземпляров графиков
let facultyPerfChart = null;
let eduFormChart = null;
let extracurricularChart = null;

/**
 * Главная функция, которую вызывает диспетчер dashboard.js
 */
async function initRectorateDashboard() {
    try {
        const response = await fetch('templates/rectorate-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для ректората');
        const templateHtml = await response.text();
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        await loadRectorateWidgetsData();

    } catch (error) {
        console.error("Ошибка при инициализации панели ректората:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса ректората.</p></div>';
    }
}

/**
 * Запрашивает данные для ВСЕХ виджетов ректората
 */
async function loadRectorateWidgetsData() {
    console.log("Загружаем данные для виджетов ректората...");
    // TODO: Показать скелетоны/заглушки

    const requestBody = {
        filters: {
            rectorateId: currentUser.id // Просто для идентификации роли на бэкенде
        },
        widgetIds: [
            "facultyPerformanceComparison",
            "educationFormDistribution",
            "extracurricularActivityOverview"
        ]
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        renderFacultyPerformanceChart(analyticsData.widgets.facultyPerformanceComparison.data);
        renderEducationFormChart(analyticsData.widgets.educationFormDistribution.data);
        renderExtracurricularChart(analyticsData.widgets.extracurricularActivityOverview.data);

    } catch (error) {
        console.error("Ошибка при загрузке данных для виджетов ректората:", error);
        document.getElementById('dashboard-grid-rectorate').innerHTML =
            '<div class="widget"><p>Не удалось загрузить данные для панели.</p></div>';
    }
}

// --- ФУНКЦИИ РЕНДЕРИНГА ---

/**
 * 1. Рендеринг графика "Сравнение успеваемости факультетов"
 */
function renderFacultyPerformanceChart(data) {
    const container = document.getElementById('widget-faculty-performance');
    const placeholder = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        placeholder.innerHTML = '<p>Нет данных для отображения.</p>';
        return;
    }
    
    placeholder.innerHTML = '<canvas id="facultyPerfCanvas"></canvas>';
    const ctx = document.getElementById('facultyPerfCanvas').getContext('2d');

    if (facultyPerfChart) facultyPerfChart.destroy();

    facultyPerfChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.facultyName),
            datasets: [{
                label: 'Средний балл',
                data: data.map(item => item.averageMark),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, suggestedMax: 10 } },
            plugins: { legend: { display: false } }
        }
    });
}

/**
 * 2. Рендеринг графика "Распределение по формам обучения"
 */
function renderEducationFormChart(data) {
    const container = document.getElementById('widget-education-form');
    const placeholder = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        placeholder.innerHTML = '<p>Нет данных для отображения.</p>';
        return;
    }

    placeholder.innerHTML = '<canvas id="eduFormCanvas"></canvas>';
    const ctx = document.getElementById('eduFormCanvas').getContext('2d');

    if (eduFormChart) eduFormChart.destroy();

    eduFormChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(item => item.label === 'BUDGET' ? 'Бюджет' : 'Платно'),
            datasets: [{
                data: data.map(item => item.count),
                backgroundColor: ['rgba(75, 192, 192, 0.6)', 'rgba(255, 159, 64, 0.6)'],
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: 'top' } }
        }
    });
}

/**
 * 3. Рендеринг графика "Обзор внеучебной деятельности"
 */
function renderExtracurricularChart(data) {
    const container = document.getElementById('widget-extracurricular-activity');
    const placeholder = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        placeholder.innerHTML = '<p>Нет данных для отображения.</p>';
        return;
    }
    
    placeholder.innerHTML = '<canvas id="extracurricularCanvas"></canvas>';
    const ctx = document.getElementById('extracurricularCanvas').getContext('2d');

    if (extracurricularChart) extracurricularChart.destroy();

    // Преобразуем плоский список в структуру, удобную для Chart.js
    const faculties = [...new Set(data.map(item => item.facultyName))];
    const categories = [...new Set(data.map(item => item.category))];
    const categoryTranslations = {
        'SCIENCE': 'Наука',
        'SOCIAL': 'Общественная',
        'SPORTS': 'Спорт',
        'CULTURE': 'Культура'
    };
    const colors = {
        'SCIENCE': 'rgba(54, 162, 235, 0.6)',
        'SOCIAL': 'rgba(255, 206, 86, 0.6)',
        'SPORTS': 'rgba(255, 99, 132, 0.6)',
        'CULTURE': 'rgba(75, 192, 192, 0.6)'
    };

    const datasets = categories.map(category => {
        return {
            label: categoryTranslations[category] || category,
            data: faculties.map(faculty => {
                const item = data.find(d => d.facultyName === faculty && d.category === category);
                return item ? item.totalPoints : 0;
            }),
            backgroundColor: colors[category] || 'rgba(153, 102, 255, 0.6)',
        };
    });

    extracurricularChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: faculties,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: { stacked: true },
                y: { stacked: true, beginAtZero: true }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
            }
        }
    });
}