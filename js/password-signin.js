(() => {
    'use strict';
    const params = new URLSearchParams(location.search);
    const origin = params.get('origin'), nonce = params.get('nonce');
    const form = document.getElementById('password-signin-form');
    const status = document.getElementById('password-status');
    const field = document.getElementById('password');
    const button = form.querySelector('button');
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (!origin || !/^[A-Za-z0-9_-]{43}$/.test(nonce || '') || !window.opener) {
            status.textContent = 'Open this sign-in window from the profile menu.';
            return;
        }
        button.disabled = true;
        status.textContent = 'Signing in…';
        const password = field.value;
        field.value = '';
        try {
            const response = await fetch('/auth/password', { method: 'POST', credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password, origin }) });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error?.message || 'Sign-in failed.');
            window.opener.postMessage({ type: 'abs-password-signed-in', nonce, token: payload.token }, origin);
            status.textContent = 'Signed in. You can close this window.';
            window.close();
        } catch (error) {
            status.textContent = error.message || 'Sign-in failed. Try again.';
        } finally { button.disabled = false; }
    });
})();
