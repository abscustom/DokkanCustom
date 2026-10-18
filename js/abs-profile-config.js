/* Public profile routing only. Authentication handles and provider credentials never belong here. */
window.ABS_PROFILE_CONFIG = Object.freeze({
    workerOrigin: 'https://abs-manager-auth.trashullu.workers.dev',
    pagesOrigin: 'https://abscustom.github.io',
    siteBasePath: '/DokkanCustom/',
    allowedOrigins: Object.freeze([
        'https://abscustom.github.io',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
        'http://localhost:4173',
        'http://127.0.0.1:4173'
    ])
});
