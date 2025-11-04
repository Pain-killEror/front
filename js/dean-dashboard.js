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
    // 1. Загружаем HTML-шаблон для панели деканата
    try {
        const response = await fetch('templates/dean-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для деканата');
        const templateHtml = await response.text();

        // 2. Вставляем HTML в главный контейнер
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // 3. Назначаем обработчики событий на фильтры
        document.getElementById('apply-dean-filters-btn').addEventListener('click', loadDeanWidgetsData);

        // 4. Запускаем первоначальную загрузку данных для всех виджетов
        await loadDeanWidgetsData();

    } catch (error) {
        console.error("Ошибка при инициализации панели деканата:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса деканата.</p></div>';
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

    // Собираем значения из фильтров
    const facultyId = document.getElementById('faculty-filter').value || null;
    const formationYear = document.getElementById('year-filter').value || null;
    const groupId = document.getElementById('group-filter').value || null;

    // Готовим тело запроса
    const requestBody = {
        filters: {
            // Используем ID факультета текущего пользователя (сотрудника деканата)
            // currentUser - глобальная переменная из dashboard.js
            facultyId: currentUser.facultyId,
            // Дополнительные фильтры с панели
            formationYear: formationYear ? parseInt(formationYear) : null,
            groupId: groupId ? parseInt(groupId) : null
        },
        widgetIds: [
            "studentRankingList",
            "averageScoreDynamics",
            "performanceDistribution",
            "contributionAnalysis"
        ]
    };

    try {
        // Отправляем единый запрос на бэкенд
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        // Отрисовываем каждый виджет, передавая ему соответствующие данные
        renderStudentRankingTable(analyticsData.widgets.studentRankingList.data);
        renderAverageScoreDynamicsChart(analyticsData.widgets.averageScoreDynamics.data);
        renderPerformanceDistributionChart(analyticsData.widgets.performanceDistribution.data);
        renderContributionChart(analyticsData.widgets.contributionAnalysis.data);

    } catch (error) {
        console.error("Ошибка при загрузке данных для виджетов деканата:", error);
        // В случае ошибки показываем сообщение
        document.getElementById('dashboard-grid-dean').innerHTML =
            '<div class="widget"><p>Не удалось загрузить данные для панели.</p></div>';
    }
}

// --- ФУНКЦИИ РЕНДЕРИНГА ---

/**
 * 1. Рендеринг таблицы "Общий рейтинг"
 */
/**
 * 1. Рендеринг таблицы "Общий рейтинг" (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 */
function renderStudentRankingTable(data) {
    const container = document.getElementById('widget-ranking-table');
    if (!container) return;

    const tbody = container.querySelector('tbody');
    
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
 * 2. Рендеринг графика "Динамика среднего балла"
 */
function renderAverageScoreDynamicsChart(data) {
    const container = document.getElementById('widget-dynamics-chart');
    if (!container) return;

    // Удаляем заглушку и вставляем canvas
    container.innerHTML = '<canvas id="dynamicsChartCanvas"></canvas>';
    const ctx = document.getElementById('dynamicsChartCanvas').getContext('2d');

    if (dynamicsChart) {
        dynamicsChart.destroy(); // Уничтожаем старый график перед отрисовкой нового
    }

    dynamicsChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => `Семестр ${item.semester}`),
            datasets: [{
                label: 'Средний балл',
                data: data.map(item => item.averageMark),
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
                fill: true,
                tension: 0.1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * 3. Рендеринг гистограммы "Распределение по успеваемости"
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
            labels: data.map(item => item.label), // e.g., "9-10", "8-9"
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
                legend: {
                    display: false
                }
            }
        }
    });
}

/**
 * 4. Рендеринг диаграммы "Вклад внеучебной деятельности"
 */
function renderContributionChart(data) {
    const container = document.getElementById('widget-contribution-chart');
    if (!container) return;

    container.innerHTML = '<canvas id="contributionChartCanvas"></canvas>';
    const ctx = document.getElementById('contributionChartCanvas').getContext('2d');

    if (contributionChart) {
        contributionChart.destroy();
    }

    contributionChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(item => item.category), // e.g., "ACADEMIC", "SCIENCE", "SPORTS"
            datasets: [{
                label: 'Суммарные баллы',
                data: data.map(item => item.totalPoints),
                backgroundColor: [
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(255, 206, 86, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

/**
 * Вспомогательная функция для отображения заглушек во время загрузки данных
 */
function showSkeletons() {
    document.getElementById('widget-ranking-table').querySelector('tbody').innerHTML =
        '<tr><td colspan="7">Загрузка данных...</td></tr>';
    document.getElementById('widget-dynamics-chart').innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    document.getElementById('widget-distribution-chart').innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    document.getElementById('widget-contribution-chart').innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
}