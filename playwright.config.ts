import {defineConfig,devices} from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:180000,use:{baseURL:process.env.BASE_URL||'http://localhost:5173',trace:'retain-on-failure'},projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['iPhone 13'],defaultBrowserType:'chromium'}}]});
