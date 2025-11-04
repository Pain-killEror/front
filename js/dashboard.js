// Это наш новый главный файл-диспетчер.
// Его единственная задача - определить роль пользователя и загрузить
// нужный скрипт.

// Глобальная переменная для хранения информации о пользователе,
// чтобы к ней могли обращаться другие скрипты.
let currentUser = null;

// --- Главная точка входа ---
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken');
    if (!token) {
        window.location.href = 'index.html';
        return;
    }
    // Запускаем основную функцию-диспетчер
    initDashboardDispatcher();
});

async function initDashboardDispatcher() {
    try {
        // 1. Получаем информацию о текущем пользователе
        currentUser = await request('/users/me');

        // 2. Выполняем общие для всех ролей действия:
        document.getElementById('user-fullname').textContent = currentUser.fullName;
        document.getElementById('logout-button').addEventListener('click', logout);

        // 3. В зависимости от роли, загружаем соответствующий скрипт
        switch (currentUser.roleName) {
            case 'STUDENT':
                loadScript('js/student-dashboard.js', () => {
                    initStudentDashboard();
                });
                break;

            case 'ADMINISTRATOR':
                loadScript('js/admin-dashboard.js', () => {
                    initAdminDashboard();
                });
                break;

            case 'DEAN_STAFF':
                loadScript('js/dean-dashboard.js', () => {
                    initDeanDashboard();
                });
                break;
            
            case 'TEACHER':
                loadScript('js/teacher-dashboard.js', () => {
                    initTeacherDashboard();
                });
                break;

            // ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем обработку для ректората
            case 'RECTORATE_STAFF':
                loadScript('js/rectorate-dashboard.js', () => {
                    initRectorateDashboard(); // Эту функцию мы создадим в следующем файле
                });
                break;

            default:
                document.getElementById('dashboard-content').innerHTML =
                    '<div class="widget"><p>Для вашей роли панель не настроена.</p></div>';
        }
    } catch (error) {
        console.error("Ошибка инициализации панели:", error);
        logout(); // Если не удалось получить данные пользователя, разлогиниваем
    }
}

// Вспомогательная функция для динамической загрузки скриптов
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