// Это наш новый главный файл-диспетчер.
// Его единственная задача - определить роль пользователя и загрузить
// нужный скрипт.

// Глобальная переменная для хранения информации о пользователе,
// чтобы к ней могли обращаться другие скрипты (например, student-dashboard.js)
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
        //  - Устанавливаем имя в шапке
        //  - Назначаем обработчик на кнопку "Выйти"
        document.getElementById('user-fullname').textContent = currentUser.fullName;
        document.getElementById('logout-button').addEventListener('click', logout);

        // 3. В зависимости от роли, загружаем соответствующий скрипт
        switch (currentUser.roleName) {
            case 'STUDENT':
                // Загружаем скрипт для студента и после загрузки вызываем его главную функцию
                loadScript('js/student-dashboard.js', () => {
                    initStudentDashboard(); // Эта функция находится в student-dashboard.js
                });
                break;

            case 'ADMINISTRATOR':
                // Загружаем скрипт для администратора и после загрузки
                // вызываем его главную функцию
                loadScript('js/admin-dashboard.js', () => {
                    initAdminDashboard(); // Эта функция находится в admin-dashboard.js
                });
                break;

            // =================================================================
            // == ИЗМЕНЕНИЕ ЗДЕСЬ: Добавляем обработку для сотрудника деканата ==
            // =================================================================
            case 'DEAN_STAFF':
                // Загружаем скрипт для сотрудника деканата
                loadScript('js/dean-dashboard.js', () => {
                    initDeanDashboard(); // Эту функцию мы создадим в следующем файле
                });
                break;
            // =================================================================

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
    script.onload = callback; // Когда скрипт загрузится, выполнить callback-функцию
    document.head.appendChild(script); // Добавляем скрипт на страницу
}

function logout() {
    localStorage.removeItem('authToken');
    window.location.href = 'index.html';
}