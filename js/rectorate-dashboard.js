// Файл: js/rectorate-dashboard.js

let eduFormChart = null;
let extracurricularChart = null;

const facultyAcronyms = {
    "Факультет компьютерных систем и сетей": "ФКСиС",
    "Факультет информационных технологий и управления": "ФИТУ",
    "Инженерно-экономический факультет": "ИЭФ",
    "Факультет инфокоммуникаций": "ФИК",
    "Факультет радиотехники и электроники": "ФРЭ",
    "Военный факультет": "ВФ",
    "Факультет инновационного непрерывного образования": "ФИНО"
};

function getShortFacultyName(fullName) {
    return facultyAcronyms[fullName] || fullName;
}

async function initRectorateDashboard() {
    try {
        const response = await fetch('templates/rectorate-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон для ректората');
        const templateHtml = await response.text();
        document.getElementById('dashboard-content').innerHTML = templateHtml;
        
        await loadRectorateWidgetsData();
        await loadRectorFaculties();
        setupReportListeners();

    } catch (error) {
        console.error("Ошибка при инициализации панели ректората:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса ректората.</p></div>';
    }
}

async function loadRectorateWidgetsData() {
    console.log("Загружаем данные для виджетов ректората...");
    const requestBody = {
        filters: { rectorateId: currentUser.id },
        widgetIds: [
            "facultyPerformanceComparison",
            "educationFormDistribution",
            "extracurricularActivityOverview"
        ]
    };

    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        
        const perfData = analyticsData.widgets.facultyPerformanceComparison.data;
        const eduData = analyticsData.widgets.educationFormDistribution.data;
        const activityData = analyticsData.widgets.extracurricularActivityOverview.data;

        renderFacultyPerformanceList(perfData);
        renderEducationFormChart(eduData);
        renderExtracurricularChart(activityData);
        calculateAndRenderMetrics(perfData, eduData, activityData);

    } catch (error) {
        console.error("Ошибка при загрузке данных:", error);
    }
}

function calculateAndRenderMetrics(perfData, eduData, activityData) {
    let totalStudents = 0;
    if (eduData) {
        totalStudents = eduData.reduce((sum, item) => sum + item.count, 0);
    }
    const elStudents = document.getElementById('metric-total-students');
    if (elStudents) elStudents.textContent = totalStudents.toLocaleString();

    let avgGpa = 0;
    if (perfData && perfData.length > 0) {
        const totalGpa = perfData.reduce((sum, item) => sum + item.averageMark, 0);
        avgGpa = totalGpa / perfData.length;
    }
    const elGpa = document.getElementById('metric-avg-gpa');
    if (elGpa) elGpa.textContent = avgGpa.toFixed(2);

    let totalActivityPoints = 0;
    if (activityData) {
        totalActivityPoints = activityData.reduce((sum, item) => sum + item.totalPoints, 0);
    }
    const elPoints = document.getElementById('metric-total-points');
    if (elPoints) elPoints.textContent = Math.round(totalActivityPoints).toLocaleString();
}

function renderFacultyPerformanceList(data) {
    const listContainer = document.getElementById('faculty-perf-list');
    if (!listContainer) return; 
    
    if (!data || data.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; padding: 20px; color: #888;">Нет данных для отображения.</p>';
        return;
    }

    data.sort((a, b) => b.averageMark - a.averageMark);

    let html = '';
    data.forEach(item => {
        const shortName = getShortFacultyName(item.facultyName);
        const avg = item.averageMark.toFixed(2);
        
        let valClass = 'perf-value';
        if (item.averageMark >= 8.0) valClass += ' high';
        else if (item.averageMark < 5.0) valClass += ' low';

        html += `
            <div class="perf-item">
                <span class="perf-name" title="${item.facultyName}">${shortName}</span>
                <span class="${valClass}">${avg}</span>
            </div>
        `;
    });

    listContainer.innerHTML = html;
}

function renderEducationFormChart(data) {
    const container = document.getElementById('widget-education-form');
    if (!container) return;

    let canvas = document.getElementById('eduFormCanvas');
    if (!canvas) {
        const placeholder = container.querySelector('.widget-content-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '<canvas id="eduFormCanvas"></canvas>';
            canvas = document.getElementById('eduFormCanvas');
        }
    }
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (eduFormChart) eduFormChart.destroy();

    if (!data || data.length === 0) return;

    eduFormChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: data.map(item => item.label === 'BUDGET' ? 'Бюджет' : 'Платно'),
            datasets: [{
                data: data.map(item => item.count),
                backgroundColor: ['#81c784', '#ffb74d'], 
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { 
                legend: { 
                    position: 'bottom',
                    labels: { color: '#546e7a', usePointStyle: true }
                } 
            }
        }
    });
}

function renderExtracurricularChart(data) {
    const container = document.getElementById('widget-extracurricular-activity');
    if (!container) return;

    let canvas = document.getElementById('extracurricularCanvas');
    if (!canvas) {
        const placeholder = container.querySelector('.widget-content-placeholder');
        if (placeholder) {
            placeholder.innerHTML = '<canvas id="extracurricularCanvas"></canvas>';
            canvas = document.getElementById('extracurricularCanvas');
        }
    }
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (extracurricularChart) extracurricularChart.destroy();

    if (!data || data.length === 0) return;

    const fullFacultyNames = [...new Set(data.map(item => item.facultyName))];
    const shortLabels = fullFacultyNames.map(name => getShortFacultyName(name));
    const categories = [...new Set(data.map(item => item.category))];

    const categoryTranslations = { 'SCIENCE': 'Наука', 'SOCIAL': 'Общественная', 'SPORTS': 'Спорт', 'CULTURE': 'Культура' };
    const colors = { 
        'SCIENCE': '#7986cb',
        'SOCIAL': '#4db6ac',
        'SPORTS': '#ffd54f',
        'CULTURE': '#e57373'
    };

    const datasets = categories.map(category => ({
        label: categoryTranslations[category] || category,
        data: fullFacultyNames.map(faculty => {
            const item = data.find(d => d.facultyName === faculty && d.category === category);
            return item ? item.totalPoints : 0;
        }),
        backgroundColor: colors[category] || '#90a4ae',
        borderRadius: 4,
    }));

    extracurricularChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: shortLabels, datasets: datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: { 
                x: { stacked: true, grid: { display: false } }, 
                y: { stacked: true, grid: { color: '#f0f0f0' }, ticks: { color: '#90a4ae' } } 
            },
            plugins: { 
                legend: { 
                    display: true, position: 'top', align: 'end',
                    labels: { boxWidth: 12, usePointStyle: true, color: '#546e7a' }
                },
                tooltip: {
                    backgroundColor: 'rgba(55, 71, 79, 0.9)', padding: 10, cornerRadius: 4,
                    callbacks: { title: (items) => fullFacultyNames[items[0].dataIndex] }
                } 
            }
        }
    });
}

async function loadRectorFaculties() {
    const select = document.getElementById('rector-report-faculty-select');
    if (!select) return;
    try {
        const faculties = await request('/faculties', 'GET');
        select.innerHTML = '<option value="" disabled selected>Выберите факультет</option>' + 
            faculties.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
    } catch (e) {
        console.error('Ошибка загрузки факультетов:', e);
        select.innerHTML = '<option>Ошибка загрузки</option>';
    }
}

function setupReportListeners() {
    const btnAdmin = document.getElementById('btn-download-admin-report');
    if (btnAdmin) {
        btnAdmin.addEventListener('click', async () => {
            const originalText = btnAdmin.textContent;
            try {
                btnAdmin.disabled = true;
                btnAdmin.textContent = 'Генерация...';
                await downloadFile(`${API_BASE_URL}/analytics/admin-report`, `admin_report_${new Date().toISOString().slice(0,10)}.pdf`);
                // Используем Toast вместо Alert для успеха (опционально)
                showToast('Отчет успешно скачан', 'success');
            } catch (error) {
                showToast('Не удалось скачать отчет администратора', 'error');
            } finally {
                btnAdmin.disabled = false;
                btnAdmin.textContent = originalText;
            }
        });
    }

    const btnDean = document.getElementById('btn-download-dean-report');
    if (btnDean) {
        btnDean.addEventListener('click', async () => {
            const facultyId = document.getElementById('rector-report-faculty-select').value;
            const course = document.getElementById('rector-report-course-select').value;
            
            if (!facultyId) {
                // ИСПОЛЬЗУЕМ TOAST ВМЕСТО ALERT
                showToast('Пожалуйста, выберите факультет из списка', 'error');
                return;
            }

            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const academicYearStart = (currentMonth >= 9) ? currentYear : currentYear - 1;
            const formationYear = academicYearStart - (course - 1);

            const originalText = btnDean.textContent;
            try {
                btnDean.disabled = true;
                btnDean.textContent = 'Генерация...';
                const url = `${API_BASE_URL}/analytics/dean-report?facultyId=${facultyId}&formationYear=${formationYear}`;
                await downloadFile(url, `dean_report_f${facultyId}_c${course}.pdf`);
                showToast('Отчет успешно скачан', 'success');
            } catch (error) {
                showToast('Не удалось скачать отчет. Возможно, нет данных.', 'error');
            } finally {
                btnDean.disabled = false;
                btnDean.textContent = originalText;
            }
        });
    }
}

async function downloadFile(url, filename) {
    const token = localStorage.getItem('authToken');
    const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (!response.ok) throw new Error('Download failed');
    
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
}

// === ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ УВЕДОМЛЕНИЙ (TOAST) ===
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return; // Контейнер есть в main layout (dashboard.html)
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    
    // Анимация появления
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Удаление через 5 секунд
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}