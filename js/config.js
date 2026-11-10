// Paste the Apps Script web app URL (ends in /exec) between the quotes.
// It is safe to commit: every request is rejected without a valid PIN.
// When running on localhost with `npm run dev`, an empty value falls back to the local mock at /exec.
window.RIFA_CONFIG = {
    apiUrl: ''
};
