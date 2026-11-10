document.addEventListener('DOMContentLoaded', async () => {
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    const logoutBtn = document.getElementById('logoutBtn');
    const userNameSpan = document.getElementById('userName');
    const adminLink = document.getElementById('adminLink');

    const API_URL = '/api/auth';
    const path = window.location.pathname;
    const isAuthPage = path.includes('login.html') || path.includes('register.html');
    // Toda la app requiere estar logueado, salvo login/register.
    const isProtectedPage = !isAuthPage;

    function clearSession() {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userData');
    }

    // Valida el token contra el servidor (no confía en lo guardado en localStorage)
    async function checkSession() {
        const token = localStorage.getItem('userToken');

        if (!token) {
            if (isProtectedPage) {
                window.location.href = '/login.html';
            }
            return null;
        }

        try {
            const res = await fetch(`${API_URL}/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (!res.ok) {
                clearSession();
                if (isProtectedPage) {
                    window.location.href = '/login.html';
                }
                return null;
            }

            const data = await res.json();
            localStorage.setItem('userData', JSON.stringify(data.user));
            return data.user;
        } catch (error) {
            console.error('Error al verificar la sesión:', error);
            return null;
        }
    }

    function updateAuthUI(user) {
        if (isAuthPage && user) {
            window.location.href = '/index.html';
            return;
        }

        if (path.includes('admin.html') && user && user.role !== 'admin') {
            alert('No tenés permisos de administrador.');
            window.location.href = '/index.html';
            return;
        }

        if (userNameSpan && user) {
            userNameSpan.textContent = `${user.name} (${user.role === 'admin' ? 'Admin' : 'Operador'})`;
        }

        if (adminLink) {
            adminLink.classList.toggle('hidden', !user || user.role !== 'admin');
        }
    }

    // 1. MANEJO DE REGISTRO
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const name = document.getElementById('regName').value;
            const email = document.getElementById('regEmail').value;
            const password = document.getElementById('regPassword').value;

            try {
                const res = await fetch(`${API_URL}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    alert('¡Registro exitoso! Ahora podés iniciar sesión.');
                    window.location.href = '/login.html';
                } else {
                    alert(data.message || 'Error al registrar usuario');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Ocurrió un error en el servidor.');
            }
        });
    }

    // 2. MANEJO DE LOGIN
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const res = await fetch(`${API_URL}/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const data = await res.json();

                if (res.ok) {
                    localStorage.setItem('userToken', data.token);
                    localStorage.setItem('userData', JSON.stringify(data.user));
                    window.location.href = '/index.html';
                } else {
                    alert(data.message || 'Credenciales incorrectas');
                }
            } catch (error) {
                console.error('Error:', error);
                alert('Error al intentar iniciar sesión.');
            }
        });
    }

    // 3. CERRAR SESIÓN (LOGOUT)
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            clearSession();
            window.location.href = '/login.html';
        });
    }

    // 4. ESTADO DE SESIÓN: protege toda la app, actualiza el navbar, redirige si ya estás logueado
    const user = await checkSession();
    updateAuthUI(user);
});
