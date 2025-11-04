//auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageDiv = document.getElementById('message');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(registerForm);
            const data = Object.fromEntries(formData.entries());

            try {
                await request('/users/register', 'POST', data);
                messageDiv.textContent = 'Вы успешно зарегистрированы! Ожидайте подтверждения от администратора.';
                messageDiv.className = 'message success';
                registerForm.reset();
            } catch (error) {
                // Ошибки уже обрабатываются в api.js
            }
        });
    }

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await request('/auth/login', 'POST', data);
                if (response && response.token) {
                    // Сохраняем токен в localStorage
                    localStorage.setItem('authToken', response.token);
                    // Перенаправляем на главную страницу
                    window.location.href = 'dashboard.html';
                }
            } catch (error) {
                // Ошибки уже обрабатываются в api.js
            }
        });
    }
});