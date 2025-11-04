// Файл: js/student-dashboard.js (ИЗМЕНЕННАЯ ВЕРСИЯ)
// Этот файл содержит ВСЮ логику, необходимую для работы панели студента.

// Глобальные переменные для графиков, которые нужны только этому скрипту
let breakdownChart = null;
let dynamicsChart = null;

// ====================================================================================
// ГЛАВНОЕ ИЗМЕНЕНИЕ: Вся логика обернута в новую функцию initStudentDashboard()
// Эту функцию будет вызывать наш главный диспетчер dashboard.js
// ====================================================================================
async function initStudentDashboard() {
    // 1. Загружаем HTML-шаблон для студента
    try {
        const response = await fetch('templates/student-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для студента');
        const templateHtml = await response.text();
        
        // 2. Вставляем HTML в главный контейнер
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // 3. Назначаем обработчики событий на элементы, которые мы только что добавили
        document.getElementById('comparison-context').addEventListener('change', loadStudentDashboardData);
        
        // 4. Запускаем загрузку данных для виджетов студента
        await loadStudentDashboardData();

    } catch (error) {
        console.error("Ошибка при инициализации панели студента:", error);
        document.getElementById('dashboard-content').innerHTML = 
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса студента.</p></div>';
    }
}

// --- ЛОГИКА ПАНЕЛИ СТУДЕНТА ---

// Эта функция отвечает за ЗАГРУЗКУ ДАННЫХ и их отрисовку
async function loadStudentDashboardData() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = getStudentSkeletons(); // Показываем скелетоны на время загрузки

    const context = document.getElementById('comparison-context').value;
    const requestBody = {
        filters: { 
            studentId: currentUser.id, // Используем глобальную переменную currentUser из dashboard.js
            comparisonContext: context,
            lines: ['cumulativeTotal'] 
        },
        widgetIds: ['myScores', 'myRank', 'myScoreBreakdown', 'myRankDynamics', 'studentRankingList']
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        
        grid.innerHTML = `
            <div id="kpi-cards" class="kpi-grid"></div>
            <div id="charts-grid" class="charts-grid">
                <div class="widget chart-container" id="breakdown-chart-container"></div>
                <div class="widget chart-container" id="dynamics-chart-container"></div>
            </div>
            <div class="widget" id="ranking-list-container">
                <h3>Рейтинг</h3>
                <div class="table-wrapper">
                    <table id="ranking-table">
                        <thead><tr><th>Место</th><th>ID Студента (анонимно)</th><th>Итоговый балл</th></tr></thead>
                        <tbody></tbody>
                    </table>
                </div>
            </div>
        `;

        renderKpiCards(analyticsData.widgets, currentUser.id);
        renderBreakdownChart(analyticsData.widgets.myScoreBreakdown.data);
        renderDynamicsChart(analyticsData.widgets.myRankDynamics.data);
        renderRankingList(analyticsData.widgets.studentRankingList.data, currentUser.id);
    } catch (error) {
        console.error("Не удалось загрузить данные для панели студента:", error);
        grid.innerHTML = '<div class="widget"><p>Не удалось загрузить данные для дашборда.</p></div>';
    }
}

// Вспомогательная функция, которая возвращает HTML-код для скелетонов
function getStudentSkeletons() {
    return `
        <div id="kpi-cards" class="kpi-grid">
            <div class="widget kpi-card"><h3>Мой итоговый балл</h3><div class="kpi-value skeleton" style="width: 60%; height: 40px; margin: 1rem auto 0;"></div></div>
            <div class="widget kpi-card"><h3>Мой средний балл</h3><div class="kpi-value skeleton" style="width: 60%; height: 40px; margin: 0 auto;"></div></div>
            <div class="widget kpi-card"><h3>Место в рейтинге</h3><div class="kpi-value skeleton" style="width: 50%; height: 40px; margin: 0 auto;"></div></div>
            <div class="widget kpi-card"><h3>Пропуски</h3><div class="kpi-value skeleton" style="width: 50%; height: 40px; margin: 0 auto;"></div></div>
        </div>
        <div id="charts-grid" class="charts-grid">
            <div class="widget chart-container skeleton"></div>
            <div class="widget chart-container skeleton"></div>
        </div>
        <div class="widget" id="ranking-list-container">
            <h3>Рейтинг</h3>
            <div class="table-wrapper skeleton" style="height: 400px;"></div>
        </div>
    `;
}

// --- ФУНКЦИИ ОБНОВЛЕНИЯ И РЕНДЕРИНГА (Ваш код) ---

async function updateDynamicsChart() {
    const container = document.getElementById('dynamics-chart-container');
    const canvas = container.querySelector('canvas');
    canvas.style.opacity = '0.5';

    const lines = Array.from(document.querySelectorAll('#dynamics-lines-filter input:checked')).map(el => el.value);
    
    const requestBody = {
        filters: { 
            studentId: currentUser.id, 
            lines: lines
        },
        widgetIds: ['myRankDynamics']
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        renderDynamicsChart(analyticsData.widgets.myRankDynamics.data);
    } catch (error) {
        console.error("Failed to update dynamics chart:", error);
        canvas.style.opacity = '1';
    }
}

function renderKpiCards(widgets, studentId) {
    const container = document.getElementById('kpi-cards');
    if (!container) return;

    const myScores = widgets.myScores.data;
    const myRank = widgets.myRank.data;
    const studentRankingData = widgets.studentRankingList.data.find(s => s.studentId === studentId);

    const totalScore = myScores && myScores.totalScore != null ? myScores.totalScore.toFixed(2) : 'N/A';
    const averageMark = myScores && myScores.averageMark != null ? myScores.averageMark.toFixed(2) : 'N/A';
    const rank = myRank && myRank.rank !== -1 ? myRank.rank : '?';
    const total = myRank ? myRank.total : '?';
    
    const academicScore = studentRankingData && studentRankingData.academicScore != null ? studentRankingData.academicScore.toFixed(2) : '0.00';
    const extracurricularScore = studentRankingData && studentRankingData.extracurricularScore != null ? studentRankingData.extracurricularScore.toFixed(2) : '0.00';
    const absencePenalty = studentRankingData && studentRankingData.absencePenalty != null ? studentRankingData.absencePenalty.toFixed(2) : '0.00';
    const unexcusedHours = studentRankingData && studentRankingData.unexcusedAbsenceHours != null ? studentRankingData.unexcusedAbsenceHours : 0;
    const excusedHours = studentRankingData && studentRankingData.excusedAbsenceHours != null ? studentRankingData.excusedAbsenceHours : 0;

    container.innerHTML = `
        <div class="widget kpi-card total-score-card">
            <h3>Мой итоговый балл</h3>
            <div class="formula-container">
                <div class="formula-text">
                    <span>Ср. балл</span> + <span>Достижения</span> - <span>Пропуски</span>
                </div>
                <div class="formula-values">
                    <span>${academicScore}</span> + <span>${extracurricularScore}</span> - <span>${absencePenalty}</span>
                </div>
            </div>
            <p class="kpi-value">${totalScore}</p>
        </div>
        <div class="widget kpi-card">
            <h3>Мой средний балл</h3>
            <p class="kpi-value">${averageMark}</p>
        </div>
        <div class="widget kpi-card">
            <h3>Место в рейтинге</h3>
            <p class="kpi-value">${rank} / ${total}</p>
        </div>
        <div class="widget kpi-card absence-card">
            <h3>Пропуски</h3>
            <div class="absence-details">
            <div class="absence-row">
                <span class="absence-label">По уваж. причине:</span>
                <span class="absence-value">${excusedHours} ч.</span>
            </div>
            <div class="absence-row">
                <span class="absence-label">По неуваж. причине:</span>
                <span class="absence-value">${unexcusedHours} ч.</span>
            </div>
        </div>
            <p class="kpi-sub-value">Снято баллов: <span class="negative-value">${absencePenalty}</span></p>
        </div>
    `;
}

function renderBreakdownChart(data) {
    const container = document.getElementById('breakdown-chart-container');
    if (!container) return;
    container.innerHTML = '<h3>Детализация баллов</h3><canvas></canvas>';
    const canvas = container.querySelector('canvas');

    if (breakdownChart) {
        breakdownChart.destroy();
    }

    breakdownChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: data.map(item => item.category),
            datasets: [{
                data: data.map(item => item.totalPoints),
                backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8'],
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        boxWidth: 20,
                        padding: 20
                    }
                }
            }
        }
    });
}

function renderDynamicsChart(data) {
    const container = document.getElementById('dynamics-chart-container');
    if (!container) return;

    let checkedLines = new Set(['cumulativeTotal']);
    const linesFilter = document.getElementById('dynamics-lines-filter');
    if (linesFilter) {
        checkedLines = new Set(Array.from(linesFilter.querySelectorAll('input:checked')).map(el => el.value));
    }
    
    if (!container.querySelector('.widget-header')) {
        container.innerHTML = `
            <div class="widget-header">
                <h3>Динамика моего рейтинга</h3>
                <button id="toggle-dynamics-filters-btn" class="filter-toggle-btn">Настроить</button>
            </div>
            <div id="dynamics-filters" class="widget-filters">
                <div class="filter-group">
                    <h4>Линии на графике:</h4>
                    <div id="dynamics-lines-filter">
                        <label><input type="checkbox" name="lines" value="cumulativeTotal"> Накопительный итог</label>
                        <label><input type="checkbox" name="lines" value="semesterTotal"> Балл за семестр</label>
                        <label><input type="checkbox" name="lines" value="academic"> Средний балл (учеба)</label>
                        <label><input type="checkbox" name="lines" value="achievements"> Достижения (накопительно)</label>
                        <label><input type="checkbox" name="lines" value="absences"> Штрафы за пропуски (накопительно)</label>
                    </div>
                </div>
                <button id="apply-dynamics-filters-btn">Применить</button>
            </div>
            <canvas></canvas>
        `;

        document.getElementById('toggle-dynamics-filters-btn').addEventListener('click', () => {
            document.getElementById('dynamics-filters').classList.toggle('open');
        });
        document.getElementById('apply-dynamics-filters-btn').addEventListener('click', () => {
            document.getElementById('dynamics-filters').classList.remove('open');
            updateDynamicsChart();
        });
    }

    document.querySelectorAll('#dynamics-lines-filter input').forEach(input => {
        input.checked = checkedLines.has(input.value);
    });

    const canvas = container.querySelector('canvas');
    canvas.style.opacity = '1';

    if (dynamicsChart) {
        dynamicsChart.destroy();
    }

    const datasets = Object.keys(data).map((key, index) => {
        const colors = ['#007bff', '#28a745', '#dc3545', '#ffc107', '#6f42c1'];
        const labels = {
            cumulativeTotal: 'Накопительный итог',
            semesterTotal: 'Балл за семестр',
            academic: 'Средний балл (учеба)',
            achievements: 'Достижения (накопительно)',
            absences: 'Штрафы за пропуски (накопительно)'
        };
        return {
            label: labels[key] || key,
            data: data[key].map(item => item.averageMark),
            borderColor: colors[index % colors.length],
            tension: 0.1,
            fill: false,
            borderWidth: 3,
            pointRadius: 5,
            pointHoverRadius: 7
        };
    });

    const allSemesters = [...new Set(Object.values(data).flatMap(arr => arr.map(item => item.semester)))].sort((a, b) => a - b);

    dynamicsChart = new Chart(canvas, {
        type: 'line',
        data: {
            labels: allSemesters.map(s => `Семестр ${s}`),
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: { line: { borderWidth: 3 }, point: { radius: 5, hoverRadius: 7 } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e9ecef' }, ticks: { font: { size: 14 } } },
                x: { grid: { display: false }, ticks: { font: { size: 14 } } }
            },
            plugins: {
                legend: { position: 'top', labels: { font: { size: 14 } } },
                tooltip: { titleFont: { size: 16 }, bodyFont: { size: 14 } }
            }
        }
    });
}

function renderRankingList(data, currentStudentId) {
    const tbody = document.querySelector('#ranking-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!data || data.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">Нет данных для отображения.</td></tr>';
        return;
    }

    data.forEach((student, index) => {
        const row = document.createElement('tr');
        if (student.studentId === currentStudentId) {
            row.classList.add('is-me');
        }
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${student.studentId}</td>
            <td>${student.totalScore.toFixed(2)}</td>
        `;
        tbody.appendChild(row);
    });
}