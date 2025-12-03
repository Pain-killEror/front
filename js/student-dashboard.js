// Файл: js/student-dashboard.js (ФИНАЛЬНАЯ ВЕРСИЯ - УБРАНЫ НАСТРОЙКИ ДЕТАЛИЗАЦИИ, БЛОКИРОВКА ТАБЛИЦЫ)

let breakdownChart = null;
let dynamicsChart = null;
let currentRankingData = []; 
let currentSortColumn = 'totalScore'; 
let currentSortOrder = 'desc'; 

const WIDGET_AUTO_STYLE = 'height: auto; min-height: 450px; display: flex; flex-direction: column;';
const CHART_FIXED_HEIGHT_STYLE = 'position: relative; height: 350px; width: 100%; overflow: hidden; margin-top: 1rem;';

const GLOBAL_STYLES = `
<style>
    input.no-spin::-webkit-outer-spin-button,
    input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
    input.no-spin[type=number] { -moz-appearance: textfield; }
    tr.search-highlight { background-color: #fff3cd !important; transition: background-color 0.5s ease; }
    
    th.sortable { cursor: pointer; user-select: none; }
    th.sortable:hover { background-color: #f1f1f1; }
    th.sortable::after { content: ' ↕'; font-size: 0.8em; color: #888; }
    th.sortable.asc::after { content: ' ↑'; color: #333; }
    th.sortable.desc::after { content: ' ↓'; color: #333; }

    /* Стиль блокировки для таблицы */
    .loading-overlay {
        opacity: 0.6;
        pointer-events: none; /* Блокируем клики */
        position: relative;
    }
    .loading-overlay::after {
        content: "Загрузка...";
        position: absolute;
        top: 50%; left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        font-weight: bold;
        z-index: 10;
    }
</style>`;

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

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

// === ИНИЦИАЛИЗАЦИЯ ===

async function initStudentDashboard() {
    try {
        const response = await fetch('templates/student-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для студента');
        const templateHtml = await response.text();

        document.getElementById('dashboard-content').innerHTML = GLOBAL_STYLES + templateHtml;
        document.getElementById('comparison-context').addEventListener('change', updateRankingData);

        await loadFullStudentDashboard();
    } catch (error) {
        console.error("Ошибка при инициализации панели студента:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса студента.</p></div>';
    }
}

async function loadFullStudentDashboard() {
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

        grid.innerHTML = `
            <div id="kpi-cards" class="kpi-grid"></div>
            <div id="charts-grid" class="charts-grid">
                <div class="widget chart-container" id="breakdown-chart-container" style="${WIDGET_AUTO_STYLE}"></div>
                <div class="widget chart-container" id="dynamics-chart-container" style="${WIDGET_AUTO_STYLE}"></div>
            </div>
            <div class="widget" id="ranking-list-container"></div>
        `;
        
        if (analyticsData && analyticsData.widgets) {
            renderKpiCards(analyticsData.widgets, currentUser.id);
            
            // ИЗМЕНЕНИЕ: Для breakdownChart берем данные напрямую (там теперь .breakdown внутри)
            // Если сервер возвращает сложный объект BAR_CHART_COMPLEX, берем из него массив .breakdown
            const breakdownData = analyticsData.widgets.myScoreBreakdown.data.breakdown || analyticsData.widgets.myScoreBreakdown.data;
            renderBreakdownChart(breakdownData);
            
            renderDynamicsChart(analyticsData.widgets.myRankDynamics.data);
            renderRankingList(analyticsData.widgets.studentRankingList.data, currentUser.id);
        }
        
    } catch (error) {
        console.error("Не удалось загрузить данные для панели студента:", error);
        grid.innerHTML = '<div class="widget"><p>Не удалось загрузить данные для дашборда.</p></div>';
    }
}

// === KPI CARDS ===

function renderKpiCards(widgets, studentId) {
    const container = document.getElementById('kpi-cards');
    if (!container) return;
    
    const myScores = widgets.myScores ? widgets.myScores.data : {};
    const myRank = widgets.myRank ? widgets.myRank.data : {};
    
    let studentRankingData = null;
    if (widgets.studentRankingList && widgets.studentRankingList.data && widgets.studentRankingList.data.data) {
        studentRankingData = widgets.studentRankingList.data.data.find(s => s.studentId === studentId);
    }
    
    const totalScore = myScores && myScores.totalScore != null ? myScores.totalScore.toFixed(2) : 'N/A';
    const averageMark = myScores && myScores.averageMark != null ? myScores.averageMark.toFixed(2) : 'N/A';
    const rank = myRank && myRank.rank !== -1 ? myRank.rank : '?';
    const total = myRank ? myRank.total : '?';

    // Данные берем из детального DTO рейтинга (там теперь есть реальные часы)
    const academicScore = studentRankingData ? studentRankingData.academicScore.toFixed(2) : '0.00';
    const extracurricularScore = studentRankingData ? studentRankingData.extracurricularScore.toFixed(2) : '0.00';
    const absencePenalty = studentRankingData ? studentRankingData.absencePenalty.toFixed(2) : '0.00';
    const unexcusedHours = studentRankingData ? studentRankingData.unexcusedAbsenceHours : 0;
    const excusedHours = studentRankingData ? studentRankingData.excusedAbsenceHours : 0;

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
            <p class="kpi-value" id="kpi-rank-value">${rank} / ${total}</p>
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

// === BREAKDOWN CHART (ИЗМЕНЕНИЕ: ПРОСТОЙ ГРАФИК БЕЗ НАСТРОЕК) ===

function renderBreakdownChart(items) {
    const container = document.getElementById('breakdown-chart-container');
    if (!container) return;

    // Просто заголовок и канвас
    container.innerHTML = `<h3>Детализация баллов</h3><div style="${CHART_FIXED_HEIGHT_STYLE}"><canvas></canvas></div>`;
    
    const canvas = container.querySelector('canvas');
    if (breakdownChart) {
        breakdownChart.destroy();
    }

    if (!items || items.length === 0) {
        // Если данных нет, можно нарисовать пустой график или ничего не делать
        return;
    }

    const categoryTranslations = {
        'ACADEMIC': 'Учеба',
        'SCIENCE': 'Наука',
        'SOCIAL': 'Общественная',
        'SPORTS': 'Спорт',
        'CULTURE': 'Культура'
    };
    
    const categoryColors = {
        'ACADEMIC': '#ffc107',
        'SCIENCE': '#28a745',
        'SOCIAL': '#007bff',
        'SPORTS': '#17a2b8',
        'CULTURE': '#dc3545'
    };

    breakdownChart = new Chart(canvas, {
        type: 'pie',
        data: {
            labels: items.map(item => categoryTranslations[item.category] || item.category),
            datasets: [{
                data: items.map(item => item.totalPoints),
                backgroundColor: items.map(item => categoryColors[item.category] || '#6c757d'),
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

// === RANKING TABLE & FILTERS ===

async function updateRankingListByFilter() {
    const container = document.getElementById('ranking-list-container');
    const context = document.getElementById('comparison-context').value;
    const semester = document.getElementById('ranking-semester-select').value;
    
    // ИЗМЕНЕНИЕ: Блокировка таблицы
    container.classList.add('loading-overlay');

    const requestBody = {
        filters: { studentId: currentUser.id, comparisonContext: context, rankingSemester: semester },
        widgetIds: ['myRank', 'studentRankingList']
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        
        if (analyticsData.widgets.myRank) {
            const myRank = analyticsData.widgets.myRank.data;
            const rankText = (myRank && myRank.rank !== -1) ? myRank.rank : '?';
            const totalText = myRank ? myRank.total : '?';
            document.getElementById('kpi-rank-value').textContent = `${rankText} / ${totalText}`;
        }

        if (analyticsData.widgets.studentRankingList) {
            currentRankingData = analyticsData.widgets.studentRankingList.data.data;
            renderRankingTableBody(currentUser.id);
        }
    } catch (error) {
        console.error("Failed to update ranking list:", error);
        alert("Ошибка при обновлении");
    } finally {
        // ИЗМЕНЕНИЕ: Снятие блокировки
        container.classList.remove('loading-overlay');
    }
}

async function updateRankingData() {
    const container = document.getElementById('ranking-list-container');
    const context = document.getElementById('comparison-context').value;
    
    // Блокировка
    container.classList.add('loading-overlay');
    const rankValueElement = document.getElementById('kpi-rank-value');
    if (rankValueElement) rankValueElement.textContent = '...';

    let selectedSemester = null;
    const semesterSelect = document.getElementById('ranking-semester-select');
    if (semesterSelect) selectedSemester = semesterSelect.value;

    const requestBody = {
        filters: { studentId: currentUser.id, comparisonContext: context, rankingSemester: selectedSemester },
        widgetIds: ['myRank', 'studentRankingList']
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        
        if (rankValueElement && analyticsData.widgets.myRank) {
            const myRank = analyticsData.widgets.myRank.data;
            const rankText = (myRank && myRank.rank !== -1) ? myRank.rank : '?';
            const totalText = myRank ? myRank.total : '?';
            rankValueElement.textContent = `${rankText} / ${totalText}`;
        }
        if (analyticsData.widgets.studentRankingList) {
            renderRankingList(analyticsData.widgets.studentRankingList.data, currentUser.id);
        }
    } catch (error) {
        console.error("Ошибка при обновлении рейтинга:", error);
        if (rankValueElement) rankValueElement.textContent = 'Ошибка';
    } finally {
        // Снятие блокировки
        container.classList.remove('loading-overlay');
    }
}

function renderRankingList(dataWrapper, currentStudentId) {
    const container = document.getElementById('ranking-list-container');
    if (!container) return;

    currentRankingData = dataWrapper.data || [];
    const availableSemesters = dataWrapper.availableSemesters || [];
    const selectedSemester = dataWrapper.selectedSemester;

    if (!container.querySelector('.widget-header')) {
        container.innerHTML = `
            <div class="widget-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0;">Рейтинг</h3>
                <div style="display: flex; gap: 5px;">
                    <button id="toggle-ranking-filters-btn" class="filter-toggle-btn" style="margin-right: 10px;">Настроить</button>
                    <input type="number" id="rank-search-input" class="no-spin" placeholder="Найти ID" 
                           style="padding: 0.4rem; border: 1px solid #ddd; border-radius: 4px; width: 80px;">
                    <button id="rank-search-btn" style="padding: 0.4rem 0.8rem; background-color: #17a2b8; color: white; border: none; border-radius: 4px;">🔍</button>
                </div>
            </div>
            
            <div id="ranking-filters" class="widget-filters">
                <div class="filter-group">
                    <h4>Семестр:</h4>
                    <select id="ranking-semester-select" style="width: 100%; padding: 0.5rem; margin-bottom: 1rem; border: 1px solid #ddd; border-radius: 4px;">
                        <option value="">Все семестры</option>
                    </select>
                    <h4>Отображать столбцы:</h4>
                    <div id="ranking-columns-filter">
                        <label><input type="checkbox" name="cols" value="academicScore" checked> Академ. балл</label>
                        <label><input type="checkbox" name="cols" value="extracurricularScore"> Внеуч. балл</label>
                        <label><input type="checkbox" name="cols" value="absencePenalty"> Штраф</label>
                        <label><input type="checkbox" name="cols" value="totalScore" checked> Итоговый балл</label>
                    </div>
                </div>
                <button id="apply-ranking-filters-btn">Применить</button>
            </div>

            <div class="table-wrapper">
                <table id="ranking-table" style="width: 100%; border-collapse: collapse;">
                    <thead></thead>
                    <tbody></tbody>
                </table>
            </div>
        `;

        setupRankingSearch();

        document.getElementById('toggle-ranking-filters-btn').addEventListener('click', () => {
            document.getElementById('ranking-filters').classList.toggle('open');
        });
        document.getElementById('apply-ranking-filters-btn').addEventListener('click', async () => {
            document.getElementById('ranking-filters').classList.remove('open');
            await updateRankingListByFilter();
        });
    }

    const select = document.getElementById('ranking-semester-select');
    select.innerHTML = '<option value="">Все семестры</option>';
    availableSemesters.forEach(sem => {
        const option = document.createElement('option');
        option.value = sem;
        option.textContent = `Семестр ${sem}`;
        if (selectedSemester && sem == selectedSemester) option.selected = true;
        select.appendChild(option);
    });

    renderRankingTableBody(currentStudentId);
}

function renderRankingTableBody(currentStudentId) {
    const table = document.getElementById('ranking-table');
    const thead = table.querySelector('thead');
    const tbody = table.querySelector('tbody');
    
    const checkboxes = document.querySelectorAll('#ranking-columns-filter input:checked');
    const selectedCols = Array.from(checkboxes).map(cb => cb.value);
    
    if (selectedCols.length === 0) selectedCols.push('academicScore', 'totalScore');

    let headerHtml = '<tr><th>Место</th><th>ID</th>';
    const colLabels = { 'academicScore': 'Академ.', 'extracurricularScore': 'Внеуч.', 'absencePenalty': 'Штраф', 'totalScore': 'Итого' };

    selectedCols.forEach(col => {
        const sortClass = currentSortColumn === col ? (currentSortOrder === 'asc' ? 'sortable asc' : 'sortable desc') : 'sortable';
        headerHtml += `<th class="${sortClass}" data-col="${col}">${colLabels[col]}</th>`;
    });
    headerHtml += '</tr>';
    thead.innerHTML = headerHtml;

    thead.querySelectorAll('th.sortable').forEach(th => {
        th.addEventListener('click', () => {
            const col = th.dataset.col;
            if (currentSortColumn === col) currentSortOrder = currentSortOrder === 'asc' ? 'desc' : 'asc';
            else { currentSortColumn = col; currentSortOrder = 'desc'; }
            renderRankingTableBody(currentStudentId);
        });
    });

    currentRankingData.sort((a, b) => {
        const valA = a[currentSortColumn] || 0;
        const valB = b[currentSortColumn] || 0;
        return currentSortOrder === 'asc' ? valA - valB : valB - valA;
    });

    tbody.innerHTML = '';
    if (!currentRankingData || currentRankingData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${2 + selectedCols.length}" style="text-align:center">Нет данных</td></tr>`;
        return;
    }

    currentRankingData.forEach((student, index) => {
        const row = document.createElement('tr');
        if (student.studentId === currentStudentId) row.classList.add('is-me');
        
        let rowHtml = `<td>${index + 1}</td><td>${student.studentId}</td>`;
        selectedCols.forEach(col => {
            const val = student[col] !== undefined ? student[col].toFixed(2) : '0.00';
            rowHtml += `<td>${col === 'totalScore' ? '<strong>' + val + '</strong>' : val}</td>`;
        });
        
        row.innerHTML = rowHtml;
        tbody.appendChild(row);
    });

    const tableWrapper = document.querySelector('#ranking-list-container .table-wrapper');
    const myRow = tbody.querySelector('.is-me');
    if (tableWrapper && myRow) {
        setTimeout(() => {
            const scrollTo = myRow.offsetTop - (tableWrapper.clientHeight / 2) + (myRow.clientHeight / 2);
            tableWrapper.scrollTo({ top: scrollTo, behavior: 'smooth' });
        }, 100);
    }
}

function setupRankingSearch() {
    const btn = document.getElementById('rank-search-btn');
    const input = document.getElementById('rank-search-input');
    if(!btn || !input) return;

    const performSearch = () => {
        const searchId = input.value.trim();
        if (!searchId) return;
        const rows = document.querySelectorAll('#ranking-table tbody tr');
        let found = false;
        rows.forEach(row => row.classList.remove('search-highlight'));
        for (const row of rows) {
            const cellId = row.cells[1].textContent;
            if (cellId === searchId) {
                found = true;
                row.classList.add('search-highlight');
                const tableWrapper = document.querySelector('#ranking-list-container .table-wrapper');
                if (tableWrapper) {
                    const scrollTo = row.offsetTop - (tableWrapper.clientHeight / 2) + (row.clientHeight / 2);
                    tableWrapper.scrollTo({ top: scrollTo, behavior: 'smooth' });
                }
                break;
            }
        }
        if (!found) alert(`Студент с ID ${searchId} не найден в этом списке.`);
    };
    btn.addEventListener('click', performSearch);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSearch(); });
}

// === DYNAMICS CHART ===

async function updateDynamicsChart() {
    const container = document.getElementById('dynamics-chart-container');
    const canvas = container.querySelector('canvas');
    const errorMsg = document.getElementById('compare-error-msg');
    
    if (canvas) canvas.style.opacity = '0.5';
    if (errorMsg) errorMsg.style.display = 'none';
    
    let lines = Array.from(document.querySelectorAll('#dynamics-lines-filter input:checked')).map(el => el.value);
    if (lines.length === 0) {
        lines = ['cumulativeTotal'];
        const defaultCheckbox = document.querySelector('#dynamics-lines-filter input[value="cumulativeTotal"]');
        if (defaultCheckbox) defaultCheckbox.checked = true;
    }

    const compareIdInput = document.getElementById('compare-student-id');
    const compareId = compareIdInput ? compareIdInput.value : null;

    const requestBody = {
        filters: { studentId: currentUser.id, lines: lines, compareWithStudentId: compareId },
        widgetIds: ['myRankDynamics']
    };
    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        const data = analyticsData.widgets.myRankDynamics.data;
        const hasCompareData = Object.keys(data).some(key => key.endsWith('_compare'));

        if (compareId && !hasCompareData) {
            if (errorMsg) {
                errorMsg.textContent = `Студент с ID ${compareId} не найден или не имеет данных.`;
                errorMsg.style.display = 'block';
            }
            if (canvas) canvas.style.opacity = '1';
            return false;
        }
        renderDynamicsChart(data);
        return true;
    } catch (error) {
        console.error("Failed to update dynamics chart:", error);
        if (canvas) canvas.style.opacity = '1';
        return false;
    }
}

function renderDynamicsChart(data) {
    const container = document.getElementById('dynamics-chart-container');
    if (!container) return;

    let checkedLines = new Set(['cumulativeTotal']);
    const linesFilter = document.getElementById('dynamics-lines-filter');
    if (linesFilter) {
        checkedLines = new Set(Array.from(linesFilter.querySelectorAll('input:checked')).map(el => el.value));
    }
    
    const existingInput = document.getElementById('compare-student-id');
    const currentValue = existingInput ? existingInput.value : '';
    const existingError = document.getElementById('compare-error-msg');
    const isErrorVisible = existingError && existingError.style.display === 'block';
    const errorText = existingError ? existingError.textContent : '';

    if (!container.querySelector('.widget-header')) {
        const noSpinStyle = `
        <style>
            input.no-spin::-webkit-outer-spin-button,
            input.no-spin::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
            input.no-spin[type=number] { -moz-appearance: textfield; }
        </style>`;

        container.innerHTML = `
            ${noSpinStyle}
            <div class="widget-header">
                <h3>Динамика моего рейтинга</h3>
                <button id="toggle-dynamics-filters-btn" class="filter-toggle-btn">Настроить</button>
            </div>
            <div id="dynamics-filters" class="widget-filters">
                <div class="filter-group">
                    <h4>Сравнить с (ID):</h4>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.5rem;">
                        <input type="number" id="compare-student-id" placeholder="ID" min="1" class="no-spin" 
                               style="width: 150px; padding: 0.5rem; border: 1px solid #ddd; border-radius: 4px;"
                               oninput="if(this.value < 0) this.value = '';">
                        <button id="clear-compare-btn" title="Очистить" style="background: none; border: none; font-size: 1.5rem; line-height: 1; cursor: pointer; color: #dc3545; padding: 0 5px;">&times;</button>
                    </div>
                    <div id="compare-error-msg" style="color: #dc3545; font-size: 0.85rem; margin-bottom: 1rem; display: none;"></div>
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
            <div style="${CHART_FIXED_HEIGHT_STYLE}"><canvas></canvas></div>
        `;
        
        document.getElementById('toggle-dynamics-filters-btn').addEventListener('click', () => {
            document.getElementById('dynamics-filters').classList.toggle('open');
        });
        document.getElementById('apply-dynamics-filters-btn').addEventListener('click', async () => {
            const filters = document.getElementById('dynamics-filters');
            filters.classList.remove('open');
            const success = await updateDynamicsChart();
            if (!success) filters.classList.add('open');
        });
        document.getElementById('clear-compare-btn').addEventListener('click', () => {
            document.getElementById('compare-student-id').value = '';
            document.getElementById('compare-error-msg').style.display = 'none';
        });
    }

    if (currentValue) document.getElementById('compare-student-id').value = currentValue;
    if (isErrorVisible) {
        const errorDiv = document.getElementById('compare-error-msg');
        errorDiv.textContent = errorText;
        errorDiv.style.display = 'block';
    }

    document.querySelectorAll('#dynamics-lines-filter input').forEach(input => {
        input.checked = checkedLines.has(input.value);
    });

    const canvas = container.querySelector('canvas');
    canvas.style.opacity = '1';
    if (dynamicsChart) dynamicsChart.destroy();

    const datasets = Object.keys(data).map((key) => {
        const isCompare = key.endsWith('_compare');
        const baseKey = key.replace('_compare', '');
        let color = '#6c757d'; let label = baseKey;

        switch (baseKey) {
            case 'cumulativeTotal': color = '#007bff'; label = 'Накопительный итог'; break;
            case 'semesterTotal': color = '#17a2b8'; label = 'Балл за семестр'; break;
            case 'academic': color = '#ffc107'; label = 'Средний балл (учеба)'; break;
            case 'achievements': color = '#6610f2'; label = 'Достижения'; break;
            case 'excused': color = '#28a745'; label = 'Уваж. пропуски (ч.)'; break; 
            case 'unexcused': color = '#dc3545'; label = 'Неуваж. пропуски (ч.)'; break; 
        }
        if (isCompare) label += ' (Сравнение)';

        return {
            label: label,
            data: data[key].map(item => item.averageMark), 
            borderColor: color,
            backgroundColor: color,
            tension: 0.1,
            fill: false,
            borderWidth: isCompare ? 2 : 3,
            borderDash: isCompare ? [5, 5] : [],
            pointStyle: isCompare ? 'rect' : 'circle',
            pointRadius: 4,
            pointHoverRadius: 6
        };
    });

    const allSemesters = [...new Set(Object.values(data).flatMap(arr => arr.map(item => item.semester)))].sort((a, b) => a - b);

    dynamicsChart = new Chart(canvas, {
        type: 'line',
        data: { labels: allSemesters.map(s => `Семестр ${s}`), datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            elements: { line: { borderWidth: 3 } },
            scales: { y: { beginAtZero: true, grid: { color: '#e9ecef' } }, x: { grid: { display: false } } },
            plugins: { legend: { position: 'top' }, tooltip: { mode: 'index', intersect: false } }
        }
    });
}