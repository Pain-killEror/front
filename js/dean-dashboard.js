// Файл: js/dean-dashboard.js
// Этот файл содержит ВСЮ логику, необходимую для работы панели
// сотрудника деканата.

// Глобальные переменные для хранения экземпляров графиков,
// чтобы их можно было обновлять при смене фильтров.
let dynamicsChart = null;
let distributionChart = null;
let contributionChart = null;
let allStudentsData = [];

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
        setupRankingFiltersAndSearch();

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

    const selectedCourse = document.getElementById('course-filter').value;
    
    // Вычисляем год набора на основе выбранного курса
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // getMonth() от 0 до 11
    const academicYearStart = (currentMonth >= 9) ? currentYear : currentYear - 1;
    const formationYear = academicYearStart - (selectedCourse - 1);

    // Готовим тело запроса
    const requestBody = {
        filters: {
            facultyId: currentUser.facultyId,
            formationYear: formationYear, // Отправляем вычисленный год набора
            groupId: null
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
        allStudentsData = analyticsData.widgets.studentRankingList.data.data || [];
        renderRankingAccordion();

        // Отрисовываем каждый виджет, передавая ему соответствующие данные
        // Обратите внимание, что renderStudentRankingTable теперь ожидает объект целиком
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
// Новая функция для настройки всех фильтров и поиска
function setupRankingFiltersAndSearch() {
    const courseFilter = document.getElementById('course-filter');
    const searchInput = document.getElementById('student-search-input');
    const container = document.getElementById('ranking-accordion-container');

    if (courseFilter) {
        // При смене курса - перезагружаем данные с сервера
        courseFilter.addEventListener('change', loadDeanWidgetsData);
    }
    if (searchInput) {
        // При вводе в поиск - фильтруем уже загруженные данные
        searchInput.addEventListener('input', renderRankingAccordion);
    }
    if (container) {
        // Обработчик кликов для открытия/закрытия аккордеона
        container.addEventListener('click', (event) => {
            const header = event.target.closest('.accordion-header');
            if (header) {
                header.parentElement.classList.toggle('open');
            }
        });
    }
}


// Новая главная функция для отрисовки аккордеона
function renderRankingAccordion() {
    const container = document.getElementById('ranking-accordion-container');
    const searchValue = document.getElementById('student-search-input').value.toLowerCase();
    if (!container) return;

    // 1. Фильтруем студентов по поисковому запросу
    const filteredStudents = allStudentsData.filter(student => {
        const studentName = student.fullName.toLowerCase();
        const groupName = (student.groupName || '').toLowerCase();
        return studentName.includes(searchValue) || groupName.includes(searchValue);
    });

    // 2. Группируем отфильтрованных студентов по группам
    const groups = filteredStudents.reduce((acc, student) => {
        const groupName = student.groupName || 'Без группы';
        if (!acc[groupName]) {
            acc[groupName] = [];
        }
        acc[groupName].push(student);
        return acc;
    }, {});

    if (Object.keys(groups).length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 2rem;">Студенты не найдены.</p>';
        return;
    }

    // 3. Создаем HTML для аккордеона
    let accordionHtml = '';
    for (const groupName in groups) {
        const students = groups[groupName];
        
        let studentsHtml = students.map((student, index) => `
            <tr>
                <td>${index + 1}</td>
                <td>${student.fullName}</td>
                <td>${student.academicScore.toFixed(2)}</td>
                <td>${student.extracurricularScore.toFixed(2)}</td>
                <td>${student.absencePenalty.toFixed(2)}</td>
                <td><strong>${student.totalScore.toFixed(2)}</strong></td>
            </tr>
        `).join('');

        accordionHtml += `
            <div class="accordion-item">
                <div class="accordion-header">
                    <span>Группа: ${groupName} (${students.length} чел.)</span>
                </div>
                <div class="accordion-content">
                    <div class="student-table-wrapper">
                        <table id="ranking-table-dean">
                           <thead>
                                <tr>
                                    <th>№</th>
                                    <th>ФИО</th>
                                    <th>Академ. балл</th>
                                    <th>Внеуч. балл</th>
                                    <th>Штраф</th>
                                    <th>Итого</th>
                                </tr>
                            </thead>
                            <tbody>${studentsHtml}</tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    }
    container.innerHTML = accordionHtml;
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
    // Показываем заглушку для нового аккордеона
    const accordionContainer = document.getElementById('ranking-accordion-container');
    if (accordionContainer) {
        accordionContainer.innerHTML = '<p style="text-align:center; padding: 2rem; color: #888;">Загрузка данных...</p>';
    }

    // Заглушки для остальных виджетов
    const distributionChart = document.getElementById('widget-distribution-chart');
    if (distributionChart) {
        distributionChart.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    }

    const contributionChart = document.getElementById('widget-contribution-chart');
    if (contributionChart) {
        contributionChart.innerHTML = '<div class="skeleton" style="height: 300px;"></div>';
    }
}