// Файл: js/student-dashboard.js (ИСПРАВЛЕННАЯ ВЕРСИЯ - FIX FLICKERING)

let breakdownChart = null;
let dynamicsChart = null;

// Стиль-обертка для canvas, чтобы остановить бесконечное растягивание
const CHART_WRAPPER_STYLE = 'position: relative; flex-grow: 1; min-height: 0; width: 100%; overflow: hidden;';
// Стиль для самого виджета, чтобы он имел фиксированную высоту
const WIDGET_FIXED_STYLE = 'height: 450px; display: flex; flex-direction: column; overflow: hidden;';

async function initStudentDashboard() {
    try {
        const response = await fetch('templates/student-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для студента');
        const templateHtml = await response.text();

        document.getElementById('dashboard-content').innerHTML = templateHtml;
        document.getElementById('comparison-context').addEventListener('change', loadStudentDashboardData);

        await loadStudentDashboardData();
    } catch (error) {
        console.error("Ошибка при инициализации панели студента:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса студента.</p></div>';
    }
}

async function loadStudentDashboardData() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = getStudentSkeletons();
    const context = document.getElementById('comparison-context').value;
    const requestBody = {
        filters: { 
            studentId: currentUser.id,
            comparisonContext: context,
            lines: ['cumulativeTotal'] 
        },
        widgetIds: ['myScores', 'myRank', 'myScoreBreakdown', 'myRankDynamics', 'studentRankingList']
    };
    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);

        // ИЗМЕНЕНИЕ: Добавлен style="${WIDGET_FIXED_STYLE}" к контейнерам графиков
        grid.innerHTML = `
            <div id="kpi-cards" class="kpi-grid"></div>
            <div id="charts-grid" class="charts-grid">
                <div class="widget chart-container" id="breakdown-chart-container" style="${WIDGET_FIXED_STYLE}"></div>
                <div class="widget chart-container" id="dynamics-chart-container" style="${WIDGET_FIXED_STYLE}"></div>
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

function getStudentSkeletons() {
    return `
        <div id="kpi-cards" class="kpi-grid">
            <div class="widget kpi-card"><h3>Мой итоговый балл</h3><div class="kpi-value skeleton" style="width: 60%; height: 40px; margin: 1rem auto 0;"></div></div>
            <div class="widget kpi-card"><h3>Мой средний балл</h3><div class="kpi-value skeleton" style="width: 60%; height: 40px; margin: 0 auto;"></div></div>
            <div class="widget kpi-card"><h3>Место в рейтинге</h3><div class="kpi-value skeleton" style="width: 50%; height: 40px; margin: 0 auto;"></div></div>
            <div class="widget kpi-card"><h3>Пропуски</h3><div class="kpi-value skeleton" style="width: 50%; height: 40px; margin: 0 auto;"></div></div>
        </div>
        <div id="charts-grid" class="charts-grid">
            <div class="widget chart-container skeleton" style="height: 450px;"></div>
            <div class="widget chart-container skeleton" style="height: 450px;"></div>
        </div>
        <div class="widget" id="ranking-list-container">
            <h3>Рейтинг</h3>
            <div class="table-wrapper skeleton" style="height: 400px;"></div>
        </div>
    `;
}

// --- ФУНКЦИИ ОБНОВЛЕНИЯ И РЕНДЕРИНГА ---

async function updateDynamicsChart() {
    const container = document.getElementById('dynamics-chart-container');
    const canvas = container.querySelector('canvas');
    if (canvas) canvas.style.opacity = '0.5';
    
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
        if (canvas) canvas.style.opacity = '1';
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
    
    // ИЗМЕНЕНИЕ: Используем CHART_WRAPPER_STYLE
    container.innerHTML = `<h3>Детализация баллов</h3><div style="${CHART_WRAPPER_STYLE}"><canvas></canvas></div>`;
    
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
            maintainAspectRatio: false, // Обязательно false
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
    
    // ИЗМЕНЕНИЕ: Используем CHART_WRAPPER_STYLE для canvas
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
                        <label><input type="checkbox" name="lines" value="achievements"> Достижения</label>
                        <label><input type="checkbox" name="lines" value="excused"> Уважительные (часы)</label>
                        <label><input type="checkbox" name="lines" value="unexcused"> Неуважительные (часы)</label>
                    </div>
                </div>
                <button id="apply-dynamics-filters-btn">Применить</button>
            </div>
            <div style="${CHART_WRAPPER_STYLE}"><canvas></canvas></div>
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

    const datasets = Object.keys(data).map((key) => {
        let color = '#6c757d'; 
        let label = key;

        switch (key) {
            case 'cumulativeTotal': color = '#007bff'; label = 'Накопительный итог'; break;
            case 'semesterTotal': color = '#17a2b8'; label = 'Балл за семестр'; break;
            case 'academic': color = '#ffc107'; label = 'Средний балл (учеба)'; break;
            case 'achievements': color = '#6610f2'; label = 'Достижения'; break;
            case 'excused': color = '#28a745'; label = 'Уваж. пропуски (ч.)'; break; 
            case 'unexcused': color = '#dc3545'; label = 'Неуваж. пропуски (ч.)'; break; 
        }

        return {
            label: label,
            data: data[key].map(item => item.averageMark), 
            borderColor: color,
            backgroundColor: color,
            tension: 0.1,
            fill: false,
            borderWidth: 3,
            pointRadius: 4,
            pointHoverRadius: 6
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
            maintainAspectRatio: false, // Обязательно false
            elements: { line: { borderWidth: 3 } },
            scales: {
                y: { beginAtZero: true, grid: { color: '#e9ecef' } },
                x: { grid: { display: false } }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: { mode: 'index', intersect: false }
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