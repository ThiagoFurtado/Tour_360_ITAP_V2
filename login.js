document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorMessage = document.getElementById('error-message');

    // Configurações de usuário e senha (para um login simples, sem backend)
    const VALID_USERNAME = 'user';
    const VALID_PASSWORD = 'password';

    loginForm.addEventListener('submit', (event) => {
        event.preventDefault(); // Impede o envio padrão do formulário

        const username = usernameInput.value;
        const password = passwordInput.value;

        if (username === VALID_USERNAME && password === VALID_PASSWORD) {
            // Login bem-sucedido
            errorMessage.style.display = 'none';
            // Armazena um token simples no sessionStorage para indicar que o usuário está logado
            sessionStorage.setItem('loggedIn', 'true');
            // Redireciona para a página principal
            window.location.href = 'index.html';
        } else {
            // Login falhou
            errorMessage.textContent = 'Usuário ou senha inválidos.';
            errorMessage.style.display = 'block';
        }
    });
});
