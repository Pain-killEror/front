// Файл: js/teacher-dashboard.js
// Содержит ВСЮ логику, необходимую для работы панели преподавателя.

// Глобальные переменные для хранения экземпляров графиков,
// чтобы их можно было обновлять.
let groupComparisonChart = null;

/**
 * Главная функция, которую вызывает диспетчер dashboard.js
 */
async function initTeacherDashboard() {
    // 1. Загружаем HTML-шаблон для панели преподавателя
    try {
        const response = await fetch('templates/teacher-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для преподавателя');
        const templateHtml = await response.text();

        // 2. Вставляем HTML в главный контейнер
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // 3. Запускаем первоначальную загрузку данных для всех виджетов
        await loadTeacherWidgetsData();

    } catch (error) {
        console.error("Ошибка при инициализации панели преподавателя:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса преподавателя.</p></div>';
    }
}

/**
 * Эта функция запрашивает данные для ВСЕХ виджетов преподавателя
 * через универсальный эндпоинт /api/analytics/query.
 */
async function loadTeacherWidgetsData() {
    console.log("Загружаем данные для виджетов преподавателя...");
    // TODO: Показать скелетоны/заглушки на время загрузки

    // Готовим тело запроса
    const requestBody = {
        filters: {
            // Используем ID текущего пользователя (преподавателя) из глобальной переменной
            teacherId: currentUser.id
        },
        widgetIds: [
            "myStudentPerformance",
            "myLatestAchievements",
            "myGroupComparison"
        ]
    };

    try {
        // Отправляем единый запрос на бэкенд
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        // Отрисовываем каждый виджет, передавая ему соответствующие данные
        renderStudentPerformanceTable(analyticsData.widgets.myStudentPerformance.data);
        renderLatestAchievementsList(analyticsData.widgets.myLatestAchievements.data);
        renderGroupComparisonChart(analyticsData.widgets.myGroupComparison.data);

    } catch (error) {
        console.error("Ошибка при загрузке данных для виджетов преподавателя:", error);
        // В случае ошибки показываем сообщение
        document.getElementById('dashboard-grid-teacher').innerHTML =
            '<div class="widget"><p>Не удалось загрузить данные для панели.</p></div>';
    }
}


// --- ФУНКЦИИ РЕНДЕРИНГА ---

/**
 * 1. Рендеринг таблицы "Успеваемость моих студентов"
 */
function renderStudentPerformanceTable(data) {
    const container = document.getElementById('widget-student-performance');
    if (!container) return;

    const tbody = container.querySelector('tbody');
    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4">Нет данных об успеваемости студентов.</td></tr>';
        return;
    }

    tbody.innerHTML = data.map(student => `
        <tr>
            <td>${student.studentId}</td>
            <td>${student.studentFullName}</td>
            <td>${student.groupName}</td>
            <td>${student.averageMark.toFixed(2)}</td>
        </tr>
    `).join('');
}

/**
 * 2. Рендеринг списка "Последние добавленные достижения"
 *    (ИСПРАВЛЕННАЯ ВЕРСИЯ)
 */
function renderLatestAchievementsList(data) {
    const container = document.getElementById('widget-latest-achievements');
    if (!container) return;

    const contentDiv = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        contentDiv.innerHTML = '<p>Вы еще не добавляли записи о достижениях.</p>';
        return;
    }

    // ИЗМЕНЕНИЯ ЗДЕСЬ: используем поля из AchievementDto (typeName, studentId)
    const listHtml = data.map(ach => `
        <li>
            <strong>${ach.typeName}</strong> (${ach.pointsAwarded} баллов)
            <div class="achievement-info">
                Студент ID: ${ach.studentId} | Добавлено: ${new Date(ach.createdAt).toLocaleDateString()}
            </div>
        </li>
    `).join('');

    contentDiv.innerHTML = `<ul class="achievement-list">${listHtml}</ul>`;
}


/**
 * 3. Рендеринг графика "Сравнительный анализ групп"
 */
function renderGroupComparisonChart(data) {
    const container = document.getElementById('widget-group-comparison-teacher');
    if (!container) return;

    const placeholder = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        placeholder.innerHTML = '<p>Нет данных для сравнения групп.</p>';
        return;
    }
    
    // Вставляем canvas для графика
    placeholder.innerHTML = '<canvas id="groupComparisonCanvas"></canvas>';
    const ctx = document.getElementById('groupComparisonCanvas').getContext('2d');

    if (groupComparisonChart) {
        groupComparisonChart.destroy(); // Уничтожаем старый график перед отрисовкой нового
    }

    const labels = data.map(item => item.groupName);
    const averageMarks = data.map(item => item.averageMark);

    groupComparisonChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Средний балл',
                data: averageMarks,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    suggestedMax: 10
                }
            },
            plugins: {
                legend: {
                    display: false // Легенда не нужна для одного набора данных
                }
            }
        }
    });
}