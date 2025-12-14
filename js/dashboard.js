// Файл: js/dashboard.js

let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    initDashboardDispatcher();
});

async function initDashboardDispatcher() {
    try {
        // 1. Получаем информацию о текущем пользователе
        currentUser = await request('/users/me');

        // 2. Выполняем общие для всех ролей действия:
        document.getElementById('user-fullname').textContent = currentUser.fullName;
        
        const logoutBtn = document.getElementById('logout-button');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', logout);
        }

        // --- ЛОГИКА ДЛЯ КНОПКИ ГЛОБАЛЬНОГО PDF ОТЧЕТА ---
        const pdfBtn = document.getElementById('global-report-btn');
        
        // Кнопка есть в HTML, но мы должны показать её только Админу или Ректору
        if (pdfBtn) {
            if (currentUser.roleName === 'RECTORATE_STAFF') {
                pdfBtn.style.display = 'inline-block'; // Показываем кнопку

                pdfBtn.addEventListener('click', async () => {
                    const originalText = pdfBtn.textContent;
                    try {
                        // Блокируем кнопку на время загрузки
                        pdfBtn.disabled = true;
                        pdfBtn.textContent = 'Загрузка...';
                        pdfBtn.style.cursor = 'wait';

                        const token = localStorage.getItem('authToken');
                        // API_BASE_URL определен в api.js
                        const response = await fetch(`${API_BASE_URL}/analytics/global-report`, {
                            method: 'GET',
                            headers: { 'Authorization': `Bearer ${token}` }
                        });

                        if (!response.ok) throw new Error('Ошибка при генерации отчета');

                        // Скачивание файла
                        const blob = await response.blob();
                        const url = window.URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `Global_Report_${new Date().toISOString().slice(0,10)}.pdf`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        window.URL.revokeObjectURL(url);

                    } catch (e) {
                        console.error(e);
                        alert('Не удалось скачать глобальный отчет. Подробности в консоли.');
                    } finally {
                        // Возвращаем кнопку в исходное состояние
                        pdfBtn.disabled = false;
                        pdfBtn.textContent = originalText;
                        pdfBtn.style.cursor = 'pointer';
                    }
                });
            } else {
                // Скрываем кнопку от студентов, преподавателей и сотрудников деканата
                pdfBtn.style.display = 'none';
            }
        }
        // -----------------------------------------------------

        // --- ОБРАБОТЧИКИ МОДАЛЬНОГО ОКНА ПРОФИЛЯ ---
        const profileModal = document.getElementById('profile-modal');
        const profileButton = document.getElementById('profile-button');
        const closeModalBtn = document.getElementById('close-modal-btn');

        if (profileButton) {
            profileButton.addEventListener('click', () => {
                showProfileModal(currentUser); // Показываем окно с уже загруженными данными
            });
        }

        if (closeModalBtn) {
            closeModalBtn.addEventListener('click', () => {
                profileModal.style.display = 'none';
            });
        }

        if (profileModal) {
            profileModal.addEventListener('click', (event) => {
                if (event.target === profileModal) {
                    profileModal.style.display = 'none';
                }
            });
        }

        // 3. В зависимости от роли, загружаем соответствующий скрипт
        switch (currentUser.roleName) {
            case 'STUDENT':
                loadScript('js/student-dashboard.js', () => initStudentDashboard());
                break;
            case 'ADMINISTRATOR':
                loadScript('js/admin-dashboard.js', () => initAdminDashboard());
                break;
            case 'DEAN_STAFF':
                loadScript('js/dean-dashboard.js', () => initDeanDashboard());
                break;
            case 'TEACHER':
                loadScript('js/teacher-dashboard.js', () => initTeacherDashboard());
                break;
            case 'RECTORATE_STAFF':
                loadScript('js/rectorate-dashboard.js', () => initRectorateDashboard());
                break;
            default:
                document.getElementById('dashboard-content').innerHTML =
                    '<div class="widget"><p>Для вашей роли панель не настроена.</p></div>';
        }
    } catch (error) {
        console.error("Ошибка инициализации панели:", error);
        // Если ошибка авторизации (403/401), выкидываем на логин
        if (error.message && (error.message.includes('403') || error.message.includes('401'))) {
            logout();
        }
    }
}

// --- Функция для отображения данных профиля ---
function showProfileModal(user) {
    const profileDetails = document.getElementById('profile-details');
    const modal = document.getElementById('profile-modal');

    let detailsHtml = `
        <div class="profile-details-grid">
            <strong>ID:</strong><span>${user.id}</span>
            <strong>Логин:</strong><span>${user.login}</span>
            <strong>ФИО:</strong><span>${user.fullName}</span>
            <strong>Email:</strong><span>${user.email}</span>
            <strong>Роль:</strong><span>${user.roleName || 'Не назначена'}</span>
            <strong>Статус:</strong><span>${user.status}</span>
    `;

    // Добавляем специфичную для роли информацию
    if (user.facultyName) {
        detailsHtml += `<strong>Факультет:</strong><span>${user.facultyName}</span>`;
    }
    if (user.groupName) {
        detailsHtml += `<strong>Группа:</strong><span>${user.groupName}</span>`;
    }
    if (user.specialtyName) {
        detailsHtml += `<strong>Специальность:</strong><span>${user.specialtyName}</span>`;
    }

    detailsHtml += '</div>';

    profileDetails.innerHTML = detailsHtml;
    modal.style.display = 'flex'; // Показываем модальное окно
}

function loadScript(src, callback) {
    const script = document.createElement('script');
    script.src = src;
    script.onload = callback;
    document.head.appendChild(script);
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}