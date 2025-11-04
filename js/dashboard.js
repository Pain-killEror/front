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
        document.getElementById('logout-button').addEventListener('click', logout);

        // --- ИЗМЕНЕНИЕ 1: Добавляем обработчики для модального окна ---
        const profileModal = document.getElementById('profile-modal');
        const profileButton = document.getElementById('profile-button');
        const closeModalBtn = document.getElementById('close-modal-btn');

        // Открытие модального окна
        profileButton.addEventListener('click', () => {
            showProfileModal(currentUser); // Показываем окно с уже загруженными данными
        });

        // Закрытие модального окна
        closeModalBtn.addEventListener('click', () => {
            profileModal.style.display = 'none';
        });

        // Закрытие по клику на оверлей
        profileModal.addEventListener('click', (event) => {
            if (event.target === profileModal) {
                profileModal.style.display = 'none';
            }
        });
        // --- Конец изменений 1 ---


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
        logout();
    }
}

// --- ИЗМЕНЕНИЕ 2: Новая функция для отображения данных профиля ---
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
// --- Конец изменений 2 ---


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