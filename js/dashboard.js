//dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }

    // Обработчики событий для элементов, которые всегда есть на странице
    document.getElementById('logout-button').addEventListener('click', logout);
    document.getElementById('comparison-context').addEventListener('change', initDashboard);

    initDashboard();
});

// Глобальные переменные для графиков, чтобы их можно было обновлять
let breakdownChart = null;
let dynamicsChart = null;
let currentUser = null; // Сохраняем информацию о пользователе глобально

// --- Управление UI ---

function showSkeletons() {
    const grid = document.getElementById('dashboard-grid');
    grid.innerHTML = `
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

// --- Основная логика ---

async function initDashboard() {
    showSkeletons();
    try {
        currentUser = await request('/users/me');
        document.getElementById('user-fullname').textContent = currentUser.fullName;

        switch (currentUser.roleName) {
            case 'STUDENT':
                await loadStudentDashboard(currentUser.id);
                break;
            default:
                document.getElementById('dashboard-grid').innerHTML = '<div class="widget"><p>Для вашей роли дашборд еще не настроен.</p></div>';
        }
    } catch (error) {
        console.error("Failed to initialize dashboard:", error);
        logout();
    }
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}

async function loadStudentDashboard(studentId) {
    const context = document.getElementById('comparison-context').value;
    const lines = ['cumulativeTotal']; // Начальное значение для первого рендера
    const absenceType = null;

    const requestBody = {
        filters: { studentId, comparisonContext: context, lines },
        widgetIds: ['myScores', 'myRank', 'myScoreBreakdown', 'myRankDynamics', 'studentRankingList']
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        
        document.getElementById('dashboard-grid').innerHTML = `
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

        renderKpiCards(analyticsData.widgets, studentId);
        renderBreakdownChart(analyticsData.widgets.myScoreBreakdown.data);
        renderDynamicsChart(analyticsData.widgets.myRankDynamics.data);
        renderRankingList(analyticsData.widgets.studentRankingList.data, studentId);
    } catch (error) {
        console.error("Failed to load student dashboard data:", error);
        document.getElementById('dashboard-grid').innerHTML = '<div class="widget"><p>Не удалось загрузить данные для дашборда.</p></div>';
    }
}

async function updateDynamicsChart() {
    const container = document.getElementById('dynamics-chart-container');
    const canvas = container.querySelector('canvas');
    canvas.style.opacity = '0.5';

    const lines = Array.from(document.querySelectorAll('#dynamics-lines-filter input:checked')).map(el => el.value);
    const absenceTypeElement = document.getElementById('absence-type-filter');
    const absenceType = absenceTypeElement.value === "" ? null : absenceTypeElement.value;

    const requestBody = {
        filters: { studentId: currentUser.id, lines },
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

// --- Функции рендеринга ---

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
    type: 'pie', // или 'doughnut' для диаграммы-пончика
    data: {
        labels: data.map(item => item.category),
        datasets: [{
            data: data.map(item => item.totalPoints),
            backgroundColor: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#17a2b8'],
            borderWidth: 2 // Добавим белую рамку между секторами
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'right', // <-- ГЛАВНОЕ ИЗМЕНЕНИЕ: Легенда справа
                align: 'center', // Выравниваем по центру
                labels: {
                    boxWidth: 20,
                    padding: 20 // Отступ между элементами легенды
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
    
    let selectedAbsenceType = document.getElementById('absence-type-filter')?.value;

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
    if (selectedAbsenceType) {
        document.getElementById('absence-type-filter').value = selectedAbsenceType;
    }

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
        // --- ВОТ БЛОК С НАСТРОЙКАМИ ВНЕШНЕГО ВИДА ---
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: {
                line: {
                    borderWidth: 3 // Толщина линии
                },
                point: {
                    radius: 5, // Размер точек
                    hoverRadius: 7 // Размер точек при наведении
                }
            },
            scales: {
                y: {
                    beginAtZero: true, // Ось Y всегда с нуля
                    grid: {
                        color: '#e9ecef' // Цвет сетки
                    },
                    ticks: {
                        font: {
                            size: 14 // Размер шрифта на оси Y
                        }
                    }
                },
                x: {
                    grid: {
                        display: false // Убираем вертикальную сетку
                    },
                    ticks: {
                        font: {
                            size: 14 // Размер шрифта на оси X
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        font: {
                            size: 14 // Размер шрифта легенды
                        }
                    }
                },
                tooltip: {
                    titleFont: {
                        size: 16 // Размер шрифта заголовка подсказки
                    },
                    bodyFont: {
                        size: 14 // Размер шрифта тела подсказки
                    }
                }
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