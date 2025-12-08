//api.js

const API_BASE_URL = 'http://localhost:8080/api';

async function request(endpoint, method = 'GET', body = null) {
    const headers = {
        'Content-Type': 'application/json'
    };

    const token = localStorage.getItem('authToken');
    
    // ИЗМЕНЕНИЕ: Проверяем, не является ли это запросом на вход или регистрацию.
    // Если мы входим в систему, нам НЕЛЬЗЯ отправлять старый (возможно протухший) токен,
    // иначе сервер попытается его проверить и может выдать ошибку 403 до того, как обработает логин.
    const isAuthRequest = endpoint.includes('/auth/login') || endpoint.includes('/users/register');

    if (token && !isAuthRequest) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        method: method,
        headers: headers
    };

    if (body) {
        config.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

        if (!response.ok) {
            // Попробуем прочитать тело ошибки, если оно есть
            let errorMessage = `Ошибка ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.message || JSON.stringify(errorData);
            } catch (e) {
                // Тела ошибки нет, используем статус
            }
            throw new Error(errorMessage);
        }

        const contentType = response.headers.get("content-type");
        if (contentType && contentType.indexOf("application/json") !== -1) {
            return await response.json();
        } else {
            return null;
        }
    } catch (error) {
        console.error('Ошибка API:', error);
     
        throw error;
    }
}