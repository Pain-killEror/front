// Файл: js/dean-dashboard.js
// Этот файл содержит ВСЮ логику, необходимую для работы панели
// сотрудника деканата.

// Глобальные переменные для хранения экземпляров графиков,
// чтобы их можно было обновлять при смене фильтров.
let dynamicsChart = null;
let distributionChart = null;
let contributionChart = null;

/**
 * Главная функция, которую будет вызывать наш диспетчер dashboard.js
 */
async function initDeanDashboard() {
    try {
        // 1. Загрузка HTML-шаблона
        const response = await fetch('templates/dean-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для деканата');
        const templateHtml = await response.text();

        // 2. Вставка HTML в страницу
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // 3. Установка названия факультета
        const facultyNameSpan = document.getElementById('dean-faculty-name');
        if (facultyNameSpan && currentUser && currentUser.facultyName) {
            facultyNameSpan.textContent = currentUser.facultyName;
        }

    

        // 5. Первоначальная загрузка данных
        await loadDeanWidgetsData();

    } catch (error) {
        console.error("Ошибка при инициализации панели деканата:", error);
        const contentDiv = document.getElementById('dashboard-content');
        if(contentDiv) {
            contentDiv.innerHTML = '<div class="widget"><p>Произошла ошибка при загрузке интерфейса деканата.</p></div>';
        }
    }
}

/**
 * Эта функция будет запрашивать данные для ВСЕХ виджетов деканата
 * через универсальный эндпоинт /api/analytics/query.
 */
async function loadDeanWidgetsData() {
    console.log("Загружаем данные для виджетов деканата...");
    // Показываем скелетоны/заглушки на время загрузки
    showSkeletons();

    // Готовим тело запроса
    const requestBody = {
        filters: {
            // Используем ID факультета текущего пользователя (сотрудника деканата)
            // currentUser - глобальная переменная из dashboard.js
            facultyId: currentUser.facultyId,

            // === ИСПРАВЛЕНИЕ: Фильтры удалены, поэтому всегда отправляем null ===
            formationYear: null,
            groupId: null
            // =================================================================
        },
        widgetIds: [
            "studentRankingList",
            "performanceDistribution",
            "contributionAnalysis"
        ]
    };

    try {
        // Отправляем единый запрос на бэкенд
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        // Отрисовываем каждый виджет, передавая ему соответствующие данные
        // Обратите внимание, что renderStudentRankingTable теперь ожидает объект целиком
        renderStudentRankingTable(analyticsData.widgets.studentRankingList.data);
        renderPerformanceDistributionChart(analyticsData.widgets.performanceDistribution.data);
        renderContributionChart(analyticsData.widgets.contributionAnalysis.data);

    } catch (error) {
        console.error("Ошибка при загрузке данных для виджетов деканата:", error);
        // В случае ошибки показываем сообщение
        const grid = document.getElementById('dashboard-grid-dean');
        if (grid) {
            grid.innerHTML = '<div class="widget"><p>Не удалось загрузить данные для панели.</p></div>';
        }
    }
}

// --- ФУНКЦИИ РЕНДЕРИНГА ---

/**
 * 1. Рендеринг таблицы "Общий рейтинг"
 */
/**
 * 1. Рендеринг таблицы "Общий рейтинг" (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 */
function renderStudentRankingTable(widgetData) {
    const container = document.getElementById('widget-ranking-table');
    if (!container) return;
    const tbody = container.querySelector('tbody');

    // === ИСПРАВЛЕНИЕ ===
    // Проверяем, пришли данные в обертке (как объект) или как массив.
    // Бэкенд отправляет структуру { data: [...], availableSemesters: [...] }
    let data = [];
    if (widgetData && Array.isArray(widgetData.data)) {
        data = widgetData.data;
    } else if (Array.isArray(widgetData)) {
        data = widgetData;
    }
    // ===================

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">Нет данных для отображения.</td></tr>';
        return;
    }

    // Шаг 1: Создаем массив HTML-строк для каждой строки таблицы
    const rowsHtml = data.map((student, index) => {
        return `
            <tr>
                <td>${index + 1}</td>
                <td>${student.fullName}</td>
                <td>${student.groupName || 'N/A'}</td>
                <td>${student.academicScore.toFixed(2)}</td>
                <td>${student.extracurricularScore.toFixed(2)}</td>
                <td>${student.absencePenalty.toFixed(2)}</td>
                <td><strong>${student.totalScore.toFixed(2)}</strong></td>
            </tr>
        `;
    });

    // Шаг 2: Объединяем все строки в одну большую строку и вставляем в DOM один раз
    tbody.innerHTML = rowsHtml.join('');
}


/**
 * 3. Рендеринг гистограммы "Распределение по успеваемости" (ФИНАЛЬНАЯ ВЕРСИЯ)
 */
function renderPerformanceDistributionChart(data) {
    const container = document.getElementById('widget-distribution-chart');
    if (!container) return;

    container.innerHTML = '<canvas id="distributionChartCanvas"></canvas>';
    const ctx = document.getElementById('distributionChartCanvas').getContext('2d');

    if (distributionChart) {
        distributionChart.destroy();
    }

    distributionChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.label),
            datasets: [{
                label: 'Количество студентов',
                data: data.map(item => item.count),
                backgroundColor: [
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(255, 99, 132, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Распределение по успеваемости',
                    font: { size: 16 },
                    padding: { bottom: 20 }
                },
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    // === ИСПРАВЛЕНИЕ: Используем логарифмическую шкалу ===
                    type: 'logarithmic',
                    min: 1, // Логарифмическая шкала не может начинаться с 0
                    max: 10000,
                    ticks: {
                        callback: function(value, index, ticks) {
                            // Список желаемых меток. Добавили 1, так как шкала начинается с него.
                            const desiredTicks = [1, 10, 100, 1000, 5000, 10000];
                            if (desiredTicks.includes(value)) {
                                return value.toLocaleString('ru-RU');
                            }
                            // Скрываем все остальные автоматически сгенерированные метки
                            return null;
                        }
                    }
                    // =======================================================
                }
            }
        }
    });
}

/**
 * 4. Рендеринг диаграммы "Вклад в рейтинг" (ФИНАЛЬНАЯ ИСПРАВЛЕННАЯ ВЕРСИЯ)
 */
function renderContributionChart(data) {
    const widgetContainer = document.getElementById('widget-contribution-chart');
    if (!widgetContainer) return;

    if (!data || data.length === 0) {
        widgetContainer.innerHTML = '<h3>Вклад в рейтинг</h3><p>Нет данных для отображения.</p>';
        return;
    }

    widgetContainer.innerHTML = `
        <h3>Вклад в рейтинг</h3>
        <div class="chart-with-legend-container">
            <div id="contribution-chart-canvas-container">
                <canvas id="contributionChartCanvas"></canvas>
            </div>
            <div id="contribution-chart-legend" class="custom-legend"></div>
        </div>
    `;

    const legendContainer = document.getElementById('contribution-chart-legend');
    const ctx = document.getElementById('contributionChartCanvas').getContext('2d');

    if (contributionChart) {
        contributionChart.destroy();
    }

    const categoryTranslations = {
        'ACADEMIC': 'Учебная деятельность',
        'SCIENCE': 'Наука',
        'SOCIAL': 'Общественная',
        'SPORTS': 'Спорт',
        'CULTURE': 'Культура'
    };

    contributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(item => categoryTranslations[item.category] || item.category),
            datasets: [{
                label: 'Суммарные баллы',
                data: data.map(item => item.totalPoints),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.label || '';
                            let value = context.parsed || 0;
                            // === ИЗМЕНЕНИЕ 1: Округляем число во всплывающей подсказке ===
                            return `${label}: ${Math.round(value)} баллов`;
                        }
                    }
                }
            }
        }
    });

    legendContainer.innerHTML = '';
    data.forEach((item, index) => {
        const translatedLabel = categoryTranslations[item.category] || item.category;
        const value = item.totalPoints;
        const color = contributionChart.data.datasets[0].backgroundColor[index];

        // === ИЗМЕНЕНИЕ 2: Округляем число в легенде ===
        const legendItemHtml = `
            <div class="legend-item">
                <span class="legend-color-box" style="background-color: ${color};"></span>
                <span>${translatedLabel}: <strong>${Math.round(value)}</strong> баллов</span>
            </div>
        `;
        legendContainer.innerHTML += legendItemHtml;
    });
}

/**
 * Вспомогательная функция для отображения заглушек во время загрузки данных
 */
function showSkeletons() {
    document.getElementById('widget-ranking-table').querySelector('tbody').innerHTML =
        '<tr><td colspan="7">Загрузка данных...</td></tr>';
    document.getElementById('widget-distribution-chart').innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    document.getElementById('widget-contribution-chart').innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
}