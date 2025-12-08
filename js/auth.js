//auth.js

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const messageDiv = document.getElementById('message');

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            messageDiv.textContent = '';
            messageDiv.className = 'message';

            const formData = new FormData(loginForm);
            const data = Object.fromEntries(formData.entries());

            try {
                const response = await request('/auth/login', 'POST', data);
                
                if (response && response.token) {
                    localStorage.setItem('authToken', response.token);
                    window.location.href = 'dashboard.html';
                } else {
                    messageDiv.textContent = 'Произошла неизвестная ошибка при входе.';
                    messageDiv.className = 'message error';
                }
            } catch (error) {
                // Теперь request() пробрасывает ошибку с понятным message из нашего CustomEntryPoint
                messageDiv.textContent = error.message;
                messageDiv.className = 'message error';
            }
        });
    }

   if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                login: registerForm.login.value,
                password: registerForm.password.value,
                fullName: registerForm.fullName.value,
                email: registerForm.email.value,
            };

           try {
                await request('/users/register', 'POST', data); 
                
                messageDiv.textContent = 'Вы успешно зарегистрированы! Ожидайте подтверждения от администратора.';
                messageDiv.className = 'message success';
                registerForm.reset();
            } catch (error) {
                // Ошибки уже обрабатываются в request() и выводятся в messageDiv
                messageDiv.textContent = error.message;
                messageDiv.className = 'message error';
            }
        });
    }
});