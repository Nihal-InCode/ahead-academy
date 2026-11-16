export default function manifest() {
    return {
        name: 'Ahead Academy',
        short_name: 'Ahead Academy',
        description: 'Ahead Academy — Attendance & Academic Management System',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#082231',
        icons: [
            {
                src: '/icon-192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable',
            },
            {
                src: '/icon-512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
            },
        ],
    }
}
