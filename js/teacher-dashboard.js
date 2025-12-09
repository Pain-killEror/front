// ============================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ============================================================

let teacherSubjects = [];

// Переменные для Журнала
let allJournalGroups = [];
let displayedJournalGroupsCount = 0;

// Переменные для Успеваемости
let allPerformanceGroups = [];
let displayedPerformanceGroupsCount = 0;

// Переменная для графика
let groupComparisonChart = null;

const GROUPS_LIMIT = 50; // Грузим по 50 групп за раз

// ============================================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================================

/**
 * Главная функция, которую вызывает диспетчер dashboard.js
 */
async function initTeacherDashboard() {
    try {
        const response = await fetch('templates/teacher-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон');
        const templateHtml = await response.text();
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // 1. Загружаем предметы (один раз для обоих виджетов)
        await loadTeacherSubjects();

        // 2. Инициализируем логику виджетов
        initJournalWidget();
        initPerformanceWidget();

        // 3. Загружаем остальные аналитические виджеты (графики, достижения)
        await loadTeacherAnalyticsData();

    } catch (error) {
        console.error("Ошибка инициализации:", error);
    }
}

// Загрузка предметов преподавателя и заполнение выпадающих списков
async function loadTeacherSubjects() {
    try {
        teacherSubjects = await request('/teacher/my-subjects', 'GET');
        
        const journalSelect = document.getElementById('journal-subject-select');
        const perfSelect = document.getElementById('performance-subject-select');
        
        if (!journalSelect || !perfSelect) return;

        if (teacherSubjects.length === 0) {
            const noSub = '<option>Нет предметов</option>';
            journalSelect.innerHTML = noSub;
            perfSelect.innerHTML = noSub;
            return;
        }

        let options = '<option value="" disabled selected>-- Выберите дисциплину --</option>';
        teacherSubjects.forEach(sub => {
            options += `<option value="${sub.id}">${sub.name}</option>`;
        });
        
        journalSelect.innerHTML = options;
        perfSelect.innerHTML = options;

        // Если предмет всего один, выбираем его автоматически везде
        if (teacherSubjects.length === 1) {
            const subId = teacherSubjects[0].id;
            journalSelect.value = subId;
            perfSelect.value = subId;
            // Сразу запускаем загрузку групп
            loadJournalGroups();
            loadPerformanceGroups();
        }

    } catch (e) {
        console.error("Ошибка загрузки предметов", e);
    }
}

// ============================================================
// ЛОГИКА 1: ЭЛЕКТРОННЫЙ ЖУРНАЛ (Ввод оценок)
// ============================================================

function initJournalWidget() {
    const subjectSelect = document.getElementById('journal-subject-select');
    const groupSearch = document.getElementById('journal-group-search');
    const container = document.getElementById('journal-groups-container');

    if (!container) return;

    // Бесконечный скролл
    container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
            renderNextJournalBatch();
        }
    });

    subjectSelect.addEventListener('change', () => loadJournalGroups());
    
    groupSearch.addEventListener('input', (e) => {
        renderJournalList(e.target.value.toLowerCase());
    });
}

async function loadJournalGroups() {
    const container = document.getElementById('journal-groups-container');
    const subjectId = document.getElementById('journal-subject-select').value;
    container.innerHTML = '<p class="loading-text">Загрузка групп...</p>';
    
    if (!subjectId) {
        container.innerHTML = '<p class="loading-text">Выберите предмет</p>';
        return;
    }

    try {
        // ЗАПРАШИВАЕМ ТОЛЬКО РЕЛЕВАНТНЫЕ ГРУППЫ
        allJournalGroups = await request(`/teacher/my-relevant-groups?subjectId=${subjectId}`, 'GET');
        renderJournalList();
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:red; text-align:center">Ошибка</p>';
    }
}

function renderJournalList(searchTerm = "") {
    const container = document.getElementById('journal-groups-container');
    container.innerHTML = '';

    const filtered = allJournalGroups.filter(g => g.name.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="loading-text">Группы не найдены</p>';
        return;
    }

    filtered.forEach(g => {
        const div = document.createElement('div');
        div.className = 'journal-group-item';
        div.id = `j-group-${g.id}`;
        
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        // Возвращаем правильный HTML-код для аккордеона
        div.innerHTML = `
            <div class="journal-group-header" onclick="toggleJournalAccordion(${g.id})">
                <span>Группа ${g.name}</span>
                <span class="journal-arrow">▼</span>
            </div>
            <div class="journal-group-content" id="j-content-${g.id}">
                <p class="loading-text">Загрузка...</p>
            </div>
        `;
        // -------------------------
        
        container.appendChild(div);
        preloadJournalStudents(g.id);
    });
}

function renderNextJournalBatch() {
    const container = document.getElementById('journal-groups-container');
    let groups = allJournalGroups;
    
    if (container.dataset.filteredGroups) {
        groups = JSON.parse(container.dataset.filteredGroups);
    }

    if (displayedJournalGroupsCount >= groups.length) return;

    const batch = groups.slice(displayedJournalGroupsCount, displayedJournalGroupsCount + BATCH_SIZE);
    
    batch.forEach(g => {
        const div = document.createElement('div');
        div.className = 'journal-group-item';
        div.id = `j-group-${g.id}`;
        div.innerHTML = `
            <div class="journal-group-header" onclick="toggleJournalAccordion(${g.id})">
                <span>Группа ${g.name}</span>
                <span class="journal-arrow">▼</span>
            </div>
            <div class="journal-group-content" id="j-content-${g.id}">
                <p class="loading-text">Загрузка...</p>
            </div>
        `;
        container.appendChild(div);
        
        // Сразу грузим студентов для этой группы (параллельно)
        preloadJournalStudents(g.id);
    });
    
    displayedJournalGroupsCount += batch.length;
}

async function preloadJournalStudents(groupId) {
    const contentDiv = document.getElementById(`j-content-${groupId}`);
    const subjectId = document.getElementById('journal-subject-select').value;
    
    // Если предмет не выбран, показываем сообщение
    if (!subjectId) {
        contentDiv.innerHTML = '<p class="loading-text">Выберите предмет</p>';
        return;
    }

    try {
        // 1. Запрос данных с бэкенда (список студентов + их оценки/пропуски)
        const studentsData = await request(`/teacher/group/${groupId}/journal-data?subjectId=${subjectId}`, 'GET');
        
        // Если группа пустая
        if (studentsData.length === 0) {
            contentDiv.innerHTML = '<p class="loading-text">В этой группе нет студентов.</p>';
            return;
        }

        // 2. Собираем все уникальные даты из всех событий всех студентов
        const allDates = new Set();
        studentsData.forEach(student => {
            if (student.events) {
                student.events.forEach(event => allDates.add(event.date));
            }
        });
        
        // Превращаем Set в отсортированный массив дат
        const sortedDates = Array.from(allDates).sort();

        // 3. Формируем шапку таблицы (<th>)
        let headerHtml = '<tr><th>Студент</th>'; // Первая "липкая" колонка
        
        // Добавляем колонки для каждой даты
        sortedDates.forEach(date => {
            const d = new Date(date);
            // Форматируем дату в ДД.ММ
            const formattedDate = `${d.getDate().toString().padStart(2, '0')}.${(d.getMonth() + 1).toString().padStart(2, '0')}`;
            headerHtml += `<th>${formattedDate}</th>`;
        });
        
        // Добавляем последнюю "липкую" колонку для сегодняшней даты
        const today = new Date();
        const formattedToday = `${today.getDate().toString().padStart(2, '0')}.${(today.getMonth() + 1).toString().padStart(2, '0')}`;
        headerHtml += `<th>${formattedToday}</th></tr>`;

        // 4. Формируем строки (<tbody>) для каждого студента
        const rowsHtml = studentsData.map(student => {
            let row = `<tr><td>${student.studentFullName}</td>`; // Первая ячейка с ФИО

            // Создаем Map (словарь) для быстрого поиска оценки по дате. 
            // Это эффективнее, чем искать в массиве в цикле.
            const eventsMap = new Map();
            if (student.events) {
                student.events.forEach(e => eventsMap.set(e.date, e.value));
            }
            
            // Заполняем ячейки с оценками/пропусками за прошлые даты
            sortedDates.forEach(date => {
                const eventValue = eventsMap.get(date) || ''; // Если оценки нет, ячейка пустая
                row += `<td>${eventValue}</td>`;
            });

            // Формируем последнюю ячейку для ввода оценки/пропуска на сегодня
            const todayStr = today.toISOString().split('T')[0];
            const todayMark = eventsMap.get(todayStr);
            const hasMarkToday = todayMark !== undefined; // Проверяем, есть ли запись за сегодня

            row += `<td>
                <div class="mark-input-container">
                    <input type="text" class="mark-input" id="inp-${student.studentId}" 
                           value="${hasMarkToday ? todayMark : ''}" 
                           ${hasMarkToday ? 'disabled' : ''}
                           autocomplete="off"
                           onkeypress="handleEnter(event, ${student.studentId})">
                    <button class="save-mark-btn" onclick="saveMark(${student.studentId})">✓</button>
                </div>
            </td>`;
            
            return row + '</tr>';
        }).join('');

        // 5. Вставляем готовую таблицу в HTML
        contentDiv.innerHTML = `
            <div class="journal-table-wrapper">
                <table class="journal-table">
                    <thead>${headerHtml}</thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    } catch (e) {
        console.error("Ошибка при загрузке журнала:", e);
        contentDiv.innerHTML = '<p style="color:red; text-align:center;">Ошибка загрузки журнала</p>';
    }
}

function toggleJournalAccordion(groupId) {
    const content = document.getElementById(`j-content-${groupId}`);
    const item = document.getElementById(`j-group-${groupId}`);
    
    if (content.style.display === 'block') {
        content.style.display = 'none';
        item.classList.remove('open');
    } else {
        content.style.display = 'block';
        item.classList.add('open');
    }
}

function handleEnter(e, studentId) {
    if (e.key === 'Enter') {
        saveMark(studentId);
    }
}

async function saveMark(studentId) {
    const subjectId = document.getElementById('journal-subject-select').value;
    const input = document.getElementById(`inp-${studentId}`);
    const value = input.value.trim().toUpperCase();

    if (!value) return;

    // Валидация: либо число, либо Н/H
    const isAbsence = (value === 'Н' || value === 'H'); // Русская и английская
    const isMark = /^[0-9]+$/.test(value);

    if (!isAbsence && (!isMark || parseInt(value) < 1 || parseInt(value) > 10)) {
        showToast('Введите оценку (1-10) или "н"', 'error');
        return;
    }

    // Блокируем поле перед запросом
    input.disabled = true;

    try {
        if (isAbsence) {
            await request('/absences', 'POST', {
                studentId: studentId,
                subjectId: parseInt(subjectId),
                absenceDate: new Date().toISOString().split('T')[0],
                hours: 2,
                reasonType: 'UNEXCUSED'
            });
        } else {
            await request('/grades', 'POST', {
                studentId: studentId,
                subjectId: parseInt(subjectId),
                assessmentType: 'SEMESTER_MARK',
                mark: parseInt(value),
                examDate: new Date().toISOString().split('T')[0]
            });
        }
        showToast('Сохранено', 'success');
        // Поле остается disabled (зеленым)
    } catch (e) {
        showToast(e.message, 'error');
        // Разблокируем при ошибке
        input.disabled = false;
        input.focus();
    }
}


// ============================================================
// ЛОГИКА 2: УСПЕВАЕМОСТЬ (Просмотр среднего балла)
// ============================================================

function initPerformanceWidget() {
    const subjectSelect = document.getElementById('performance-subject-select');
    const groupSearch = document.getElementById('performance-group-search');
    const container = document.getElementById('performance-groups-container');

    if (!container) return;

    container.addEventListener('scroll', () => {
        if (container.scrollTop + container.clientHeight >= container.scrollHeight - 50) {
            renderNextPerformanceBatch();
        }
    });

    subjectSelect.addEventListener('change', () => loadPerformanceGroups());
    
    groupSearch.addEventListener('input', (e) => {
        renderPerformanceList(e.target.value.toLowerCase());
    });
}

async function loadPerformanceGroups() {
    const container = document.getElementById('performance-groups-container');
    const subjectId = document.getElementById('performance-subject-select').value;
    container.innerHTML = '<p class="loading-text">Загрузка...</p>';
    
    if (!subjectId) {
        container.innerHTML = '<p class="loading-text">Выберите предмет</p>';
        return;
    }

    try {
        allPerformanceGroups = await request(`/teacher/my-relevant-groups?subjectId=${subjectId}`, 'GET');
        renderPerformanceList();
    } catch (e) {
        console.error(e);
        container.innerHTML = '<p style="color:red; text-align:center">Ошибка</p>';
    }
}

function renderPerformanceList(searchTerm = "") {
    const container = document.getElementById('performance-groups-container');
    container.innerHTML = '';

    const filtered = allPerformanceGroups.filter(g => g.name.toLowerCase().includes(searchTerm));

    if (filtered.length === 0) {
        container.innerHTML = '<p class="loading-text">Группы не найдены</p>';
        return;
    }

    filtered.forEach(g => {
        const div = document.createElement('div');
        div.className = 'journal-group-item';
        div.id = `p-group-${g.id}`;
        
        // --- ИСПРАВЛЕНИЕ ЗДЕСЬ ---
        div.innerHTML = `
            <div class="journal-group-header" onclick="togglePerformanceAccordion(${g.id})">
                <span>Группа ${g.name}</span>
                <span class="journal-arrow">▼</span>
            </div>
            <div class="journal-group-content" id="p-content-${g.id}">
                <p class="loading-text">Загрузка...</p>
            </div>
        `;
        // -------------------------
        
        container.appendChild(div);
        preloadPerformanceStudents(g.id);
    });
}

function renderNextPerformanceBatch() {
    const container = document.getElementById('performance-groups-container');
    let groups = allPerformanceGroups;
    
    if (container.dataset.filteredGroups) {
        groups = JSON.parse(container.dataset.filteredGroups);
    }

    if (displayedPerformanceGroupsCount >= groups.length) return;

    const batch = groups.slice(displayedPerformanceGroupsCount, displayedPerformanceGroupsCount + BATCH_SIZE);
    
    batch.forEach(g => {
        const div = document.createElement('div');
        div.className = 'journal-group-item';
        div.id = `p-group-${g.id}`;
        div.innerHTML = `
            <div class="journal-group-header" onclick="togglePerformanceAccordion(${g.id})">
                <span>Группа ${g.name}</span>
                <span class="journal-arrow">▼</span>
            </div>
            <div class="journal-group-content" id="p-content-${g.id}">
                <p class="loading-text">Загрузка...</p>
            </div>
        `;
        container.appendChild(div);
        
        preloadPerformanceStudents(g.id);
    });
    
    displayedPerformanceGroupsCount += batch.length;
}

async function preloadPerformanceStudents(groupId) {
    const contentDiv = document.getElementById(`p-content-${groupId}`);
    const subjectId = document.getElementById('performance-subject-select').value;

    if (!subjectId) {
        contentDiv.innerHTML = '<p class="loading-text">Выберите предмет</p>';
        return;
    }

    try {
        // Запрос среднего балла
        const students = await request(`/teacher/group/${groupId}/performance?subjectId=${subjectId}`, 'GET');
        
        if (students.length === 0) {
            contentDiv.innerHTML = '<p class="loading-text">Пустая группа</p>';
            return;
        }

        contentDiv.innerHTML = students.map(s => {
            // Раскраска оценки
            let color = '#333';
            if (s.averageMark >= 8) color = '#28a745'; // Зеленый для отличников
            else if (s.averageMark < 4 && s.averageMark > 0) color = '#dc3545'; // Красный для двоечников

            return `
            <div class="journal-student-row">
                <div>${s.studentFullName}</div>
                <div style="font-weight:bold; color:${color}; font-size:1.1rem; min-width: 45px; text-align: center;">
                    ${s.averageMark}
                </div>
            </div>`;
        }).join('');

    } catch (e) {
        console.error(e);
        contentDiv.innerHTML = '<p style="color:red; text-align:center; padding:10px;">Ошибка</p>';
    }
}

function togglePerformanceAccordion(groupId) {
    const content = document.getElementById(`p-content-${groupId}`);
    const item = document.getElementById(`p-group-${groupId}`);
    
    if (content.style.display === 'block') {
        content.style.display = 'none';
        item.classList.remove('open');
    } else {
        content.style.display = 'block';
        item.classList.add('open');
    }
}


// ============================================================
// ЛОГИКА 3: ОСТАЛЬНАЯ АНАЛИТИКА (ГРАФИКИ, ДОСТИЖЕНИЯ)
// ============================================================

async function loadTeacherAnalyticsData() {
    console.log("Загружаем данные для виджетов преподавателя...");

    const requestBody = {
        filters: {
            teacherId: currentUser.id
        },
        widgetIds: [
            "myLatestAchievements",
            "myGroupComparison"
        ]
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        renderLatestAchievementsList(analyticsData.widgets.myLatestAchievements.data);
        renderGroupComparisonChart(analyticsData.widgets.myGroupComparison.data);

    } catch (error) {
        console.error("Ошибка при загрузке аналитики:", error);
    }
}

/**
 * Рендеринг списка "Последние добавленные достижения"
 */
function renderLatestAchievementsList(data) {
    const container = document.getElementById('widget-latest-achievements');
    if (!container) return;

    const contentDiv = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        contentDiv.innerHTML = '<p>Вы еще не добавляли записи о достижениях.</p>';
        return;
    }

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
 * Рендеринг графика "Сравнительный анализ групп"
 */
function renderGroupComparisonChart(data) {
    const container = document.getElementById('widget-group-comparison-teacher');
    if (!container) return;

    const placeholder = container.querySelector('.widget-content-placeholder');
    if (!data || data.length === 0) {
        placeholder.innerHTML = '<p>Нет данных для сравнения групп.</p>';
        return;
    }
    
    placeholder.innerHTML = '<canvas id="groupComparisonCanvas"></canvas>';
    const ctx = document.getElementById('groupComparisonCanvas').getContext('2d');

    if (groupComparisonChart) {
        groupComparisonChart.destroy();
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
                legend: { display: false }
            }
        }
    });
}