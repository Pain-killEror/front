// Глобальные переменные для кеширования справочников
let cachedFaculties = [];
let cachedSubjects = [];

// ID ролей для отправки на бэкенд
const ROLE_IDS = {
    'ADMINISTRATOR': 1,
    'DEAN_STAFF': 2,
    'TEACHER': 3,
    'STUDENT': 4,
    'RECTORATE_STAFF': 5
};

// --- ИНИЦИАЛИЗАЦИЯ ПАНЕЛИ ---
async function initAdminDashboard() {
    try {
        const response = await fetch('templates/admin-dashboard.html');
        if (!response.ok) throw new Error('Не удалось загрузить шаблон');

        const templateHtml = await response.text();
        document.getElementById('dashboard-content').innerHTML = templateHtml;

        // Запускаем параллельную загрузку всех необходимых данных
        await Promise.all([
            loadAdminWidgetsData(),
            loadPendingUsers(),
            loadFaculties(),
            loadSubjects()
        ]);

        setupApprovalModalListeners();
    } catch (error) {
        console.error("Ошибка:", error);
        document.getElementById('dashboard-content').innerHTML =
            '<div class="widget"><p>Произошла ошибка при загрузке интерфейса.</p></div>';
    }
}

// --- УВЕДОМЛЕНИЯ (TOASTS) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;

    container.appendChild(toast);

    // Показать "тост"
    setTimeout(() => toast.classList.add('show'), 10);

    // Скрыть и удалить "тост" через 5 секунд
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}

// --- ЗАГРУЗКА ДАННЫХ ---

async function loadPendingUsers() {
    const tbody = document.querySelector('#pending-users-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Загрузка...</td></tr>';
    try {
        const users = await request('/users', 'GET');
        const pendingUsers = users.filter(u => u.status === 'PENDING');

        if (pendingUsers.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">Нет заявок</td></tr>';
            return;
        }

        tbody.innerHTML = pendingUsers.map(user => `
            <tr>
                <td>${user.id}</td>
                <td>${user.fullName}</td>
                <td>${user.login}</td>
                <td>${user.email}</td>
                <td>${new Date(user.createdAt || Date.now()).toLocaleDateString()}</td>
                <td>
                    <button class="action-btn btn-approve" onclick="openApprovalModal(${user.id}, '${user.fullName.replace(/'/g, "\\'")}')">Подтвердить</button>
                    <button class="action-btn btn-reject" onclick="rejectUser(${user.id})">Удалить</button>
                </td>
            </tr>
        `).join("");
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="6" style="color:red;text-align:center;">Ошибка загрузки заявок</td></tr>';
    }
}

async function rejectUser(userId) {
    if (!confirm('Отклонить заявку и удалить пользователя?')) return;
    try {
        await request(`/users/${userId}`, 'DELETE');
        showToast('Пользователь удален.', 'success');
        loadPendingUsers();
    } catch (e) {
        showToast(`Ошибка: ${e.message}`, 'error');
    }
}

async function loadFaculties() {
    try {
        cachedFaculties = await request('/faculties', 'GET');
    } catch (e) { console.warn('Faculties load failed', e); }
}

async function loadSubjects() {
    try {
        cachedSubjects = await request('/subjects', 'GET');
    } catch (e) { console.warn('Subjects load failed', e); }
}

// --- ЛОГИКА МОДАЛЬНОГО ОКНА ---

function setupApprovalModalListeners() {
    const modal = document.getElementById('approval-modal');
    if (!modal) return;

    const roleSelect = document.getElementById('role-select');
    const saveBtn = document.getElementById('save-approval-btn');
    const closeBtns = [
        document.getElementById('close-approval-modal-btn'),
        document.getElementById('cancel-approval-btn')
    ];

    const studentFields = document.getElementById('student-fields');
    const deanFields = document.getElementById('dean-fields');
    const teacherFields = document.getElementById('teacher-fields');

    const stFacultySelect = document.getElementById('st-faculty-select');
    const stSpecialtySelect = document.getElementById('st-specialty-select');
    const stCourseSelect = document.getElementById('st-course-select');
    const stGroupSelect = document.getElementById('st-group-select');
    const groupHint = document.getElementById('group-hint');

    roleSelect.addEventListener('change', (e) => {
        const role = e.target.value;
        studentFields.style.display = (role === 'STUDENT') ? 'block' : 'none';
        deanFields.style.display = (role === 'DEAN_STAFF') ? 'block' : 'none';
        teacherFields.style.display = (role === 'TEACHER') ? 'block' : 'none';

        if (role === 'STUDENT') populateFacultySelect('st-faculty-select');
        if (role === 'DEAN_STAFF') populateFacultySelect('dean-faculty-select');
        if (role === 'TEACHER') populateSubjectsCheckboxes();
    });

    stFacultySelect.addEventListener('change', async (e) => {
        const facultyId = e.target.value;
        stSpecialtySelect.innerHTML = '<option>Загрузка...</option>';
        stSpecialtySelect.disabled = true;
        stCourseSelect.value = "";
        stCourseSelect.disabled = true;
        stGroupSelect.innerHTML = '<option value="">-- Выберите курс --</option>';
        stGroupSelect.disabled = true;

        if (!facultyId) {
             stSpecialtySelect.innerHTML = '<option value="">-- Выберите факультет --</option>';
             return;
        }

        try {
            const specialties = await request(`/specialties/faculty/${facultyId}`, 'GET');
            stSpecialtySelect.innerHTML = '<option value="">-- Выберите специальность --</option>' +
                specialties.map(s => `<option value="${s.id}">${s.name}</option>`).join("");
            stSpecialtySelect.disabled = false;
        } catch (e) {
            showToast('Ошибка загрузки специальностей', 'error');
            stSpecialtySelect.innerHTML = '<option value="">Ошибка</option>';
        }
    });

    stSpecialtySelect.addEventListener('change', (e) => {
        stCourseSelect.disabled = !e.target.value;
        stCourseSelect.value = "";
        stGroupSelect.disabled = true;
        stGroupSelect.innerHTML = '<option value="">-- Выберите курс --</option>';
    });

    stCourseSelect.addEventListener('change', async (e) => {
        const course = parseInt(e.target.value);
        const facultyId = stFacultySelect.value;
        const specialtyId = stSpecialtySelect.value;

        stGroupSelect.innerHTML = '<option>Поиск групп...</option>';
        stGroupSelect.disabled = true;
        groupHint.textContent = "";

        if (!course || !facultyId || !specialtyId) return;

        try {
            const groups = await request(`/groups/available?facultyId=${facultyId}&specialtyId=${specialtyId}&course=${course}`, 'GET');
            let optionsHtml = '<option value="">-- Выберите группу --</option>';
            const isFirstCourse = (course === 1);

            groups.forEach(g => {
                const isFull = isFirstCourse && (g.studentCount >= 15);
                let style = 'color: #333;';
                let text = `${g.name} (${g.studentCount} чел.)`;
                let disabledAttr = '';

                if (isFull) {
                    style = 'color: #dc3545; font-weight: bold;';
                    text += ' [ЗАПОЛНЕНА]';
                    disabledAttr = 'disabled';
                } else if (isFirstCourse) {
                    style = 'color: #28a745;';
                }
                optionsHtml += `<option value="${g.id}" style="${style}" ${disabledAttr}>${text}</option>`;
            });

            if (isFirstCourse) {
                optionsHtml += '<option value="NEW_GROUP" style="color: #007bff; font-weight: bold; border-top: 1px solid #ddd;">+ Создать новую группу</option>';
                groupHint.textContent = "Для 1 курса можно создать новую группу, если остальные заполнены.";
            } else {
                groupHint.textContent = "Для старших курсов лимит студентов не проверяется.";
            }

            if (groups.length === 0 && !isFirstCourse) {
                optionsHtml = '<option value="">Групп не найдено</option>';
            }
            
            stGroupSelect.innerHTML = optionsHtml;
            stGroupSelect.disabled = false;
        } catch (e) {
            showToast('Ошибка поиска групп', 'error');
            stGroupSelect.innerHTML = '<option value="">Ошибка</option>';
        }
    });
    
    saveBtn.addEventListener('click', async () => {
        const userId = document.getElementById('approval-user-id').value;
        const roleName = roleSelect.value;
        if (!roleName) return showToast('Выберите роль', 'error');

        let updateData = {};
        
        if (roleName === 'STUDENT') {
            let groupId = stGroupSelect.value;
            if (!groupId) return showToast('Выберите группу', 'error');
            
            if (groupId === 'NEW_GROUP') {
                if (!confirm("Будет автоматически создана новая группа с следующим порядковым номером. Продолжить?")) return;
                try {
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Создание группы...';
                    const newGroup = await request(`/groups/auto-create?facultyId=${stFacultySelect.value}&specialtyId=${stSpecialtySelect.value}&course=${stCourseSelect.value}`, 'POST');
                    groupId = newGroup.id;
                    showToast(`Создана группа: ${newGroup.name}`, 'info');
                } catch (e) {
                    showToast(`Ошибка при создании группы: ${e.message}`, 'error');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Подтвердить';
                    return;
                }
            }
            updateData.groupId = parseInt(groupId);
        } else if (roleName === 'DEAN_STAFF') {
            const facultyId = document.getElementById('dean-faculty-select').value;
            if (!facultyId) return showToast('Выберите факультет', 'error');
            updateData.facultyId = parseInt(facultyId);
        } else if (roleName === 'TEACHER') {
            const selectedSubjects = document.querySelectorAll('#subjects-list input:checked');
            updateData.subjectIds = Array.from(selectedSubjects).map(checkbox => parseInt(checkbox.value));
            if (updateData.subjectIds.length === 0) {
                 if (!confirm("Вы не выбрали ни одного предмета для преподавателя. Продолжить?")) return;
            }
        }

        try {
            saveBtn.textContent = 'Сохранение...';
            saveBtn.disabled = true;

            await request(`/users/${userId}/approve?roleId=${ROLE_IDS[roleName]}`, 'PATCH');
            
            if (Object.keys(updateData).length > 0) {
                await request(`/users/${userId}`, 'PUT', updateData);
            }

            modal.style.display = 'none';
            showToast("Пользователь успешно подтвержден!", 'success');
            await Promise.all([loadPendingUsers(), loadAdminWidgetsData()]);
        } catch (e) {
            showToast(`Ошибка: ${e.message}`, 'error');
        } finally {
            saveBtn.textContent = 'Подтвердить';
            saveBtn.disabled = false;
        }
    });

    const closeModal = () => { modal.style.display = 'none'; };
    closeBtns.forEach(btn => btn.onclick = closeModal);
}

window.openApprovalModal = function(userId, userName) {
    document.getElementById('approval-user-id').value = userId;
    document.getElementById('approval-username').textContent = userName;

    document.getElementById('role-select').value = "";
    document.getElementById('student-fields').style.display = 'none';
    document.getElementById('dean-fields').style.display = 'none';
    document.getElementById('teacher-fields').style.display = 'none';
    
    document.getElementById('st-specialty-select').innerHTML = '<option value="">-- Выберите факультет --</option>';
    document.getElementById('st-group-select').innerHTML = '<option value="">-- Выберите курс --</option>';
    document.getElementById('subjects-list').innerHTML = '<p style="color:#888; text-align:center;">Загрузка предметов...</p>';

    document.getElementById('approval-modal').style.display = 'flex';
};

function populateFacultySelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">-- Выберите факультет --</option>' +
        cachedFaculties.map(f => `<option value="${f.id}">${f.name}</option>`).join("");
}

function populateSubjectsCheckboxes() {
    const container = document.getElementById('subjects-list');
    if (!container) return;
    if (cachedSubjects.length === 0) {
        container.innerHTML = '<p>Не удалось загрузить список предметов.</p>';
        return;
    }
    container.innerHTML = cachedSubjects.map(subject => `
        <div class="subject-checkbox-item">
            <input type="checkbox" id="subject-${subject.id}" value="${subject.id}">
            <label for="subject-${subject.id}">${subject.name}</label>
        </div>
    `).join("");
}

// --- ГРАФИКИ И ВИДЖЕТЫ ---
async function loadAdminWidgetsData() {
    const requestBody = {
        filters: { adminId: currentUser.id },
        widgetIds: ["roleStatistics", "userStatusOverview"]
    };
    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        if (analyticsData.widgets.roleStatistics) renderRoleStatsChart(analyticsData.widgets.roleStatistics.data);
        if (analyticsData.widgets.userStatusOverview) renderUserStatusChart(analyticsData.widgets.userStatusOverview.data);
    } catch (error) { console.error("Ошибка загрузки данных для виджетов", error); }
}

async function loadAdminWidgetsData() {
    const requestBody = {
        filters: { adminId: currentUser.id },
        widgetIds: ["roleStatistics", "userStatusOverview"]
    };
    try {
        const analyticsData = await request('/analytics/query', 'POST', requestBody);
        if (analyticsData.widgets.roleStatistics) renderRoleStatsChart(analyticsData.widgets.roleStatistics.data);
        if (analyticsData.widgets.userStatusOverview) renderUserStatusChart(analyticsData.widgets.userStatusOverview.data);
    } catch (error) { console.error("Ошибка загрузки данных для виджетов", error); }
}

const CHART_WRAPPER_STYLE = 'position: relative; flex-grow: 1; min-height: 0; width: 100%; overflow: hidden;';

function renderRoleStatsChart(data) {
    const widget = document.getElementById('widget-role-stats');
    if (!widget) return;
    if (!data || data.length === 0) { widget.innerHTML = '<h3>Распределение персонала</h3><p>Нет данных для отображения.</p>'; return; }
    
    const roleTranslations = { 'ADMINISTRATOR': 'Администраторы', 'DEAN_STAFF': 'Сотрудники деканата', 'TEACHER': 'Преподаватели', 'STUDENT': 'Студенты', 'RECTORATE_STAFF': 'Сотрудники ректората' };
    widget.innerHTML = `<h3>Распределение персонала</h3><div style="${CHART_WRAPPER_STYLE}"><canvas id="roleStatsCanvas"></canvas></div>`;
    const canvas = document.getElementById('roleStatsCanvas');
    const labels = data.map(item => roleTranslations[item.label] || item.label);
    const userCounts = data.map(item => item.count);
    
    new Chart(canvas, { 
        type: 'bar', 
        data: { 
            labels: labels, 
            datasets: [{ 
                label: 'Количество', 
                data: userCounts, 
                backgroundColor: ['#007bff', '#6f42c1', '#28a745', '#17a2b8', '#6610f2'], 
                borderWidth: 1, 
                barPercentage: 0.5 
            }] 
        }, 
        options: { 
            responsive: true, 
            maintainAspectRatio: false, 
            plugins: { legend: { display: false } }, 
            scales: { 
                y: { 
                    type: 'logarithmic',
                    // ИЗМЕНЕНИЕ: Явно указываем максимальное значение для шкалы
                    max: 25000,
                    ticks: {
                        callback: function(value, index, ticks) {
                            // Покажем метки, которые вы хотите
                            const shown_ticks = [1, 10, 30, 100, 300, 1000, 3000, 10000, 25000];
                            if(shown_ticks.includes(value)){
                                return value.toLocaleString();
                            }
                        }
                    }   
                }
            } 
        } 
    });
}



function renderUserStatusChart(data) {
    const widget = document.getElementById('widget-user-activity');
    if (!widget) return;
    if (!data || data.length === 0) {
        widget.innerHTML = '<h3>Статистика по статусам</h3><p>Нет данных</p>';
        return;
    }
    
    const statusTranslations = { 'ACTIVE': 'Активные', 'PENDING': 'Ожидают', 'BLOCKED': 'Заблокированные' };

    const statsHtml = data.map(item => `
        <div class="status-item" data-status="${item.label}">
            <span class="status-label">${statusTranslations[item.label] || item.label}</span>
            <span class="status-count">${item.count}</span>
        </div>`
    ).join("");

    widget.innerHTML = `<h3>Статистика по статусам</h3><div class="status-list">${statsHtml}</div>`;
}