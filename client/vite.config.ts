import { defineConfig } from 'vite'

export default defineConfig({
    clearScreen: false,
    server: {
        proxy: {
            '/api': 'http://127.0.0.1:8098'
        }
    }
})