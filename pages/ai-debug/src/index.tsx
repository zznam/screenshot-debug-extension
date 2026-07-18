import { createRoot } from 'react-dom/client';

import { themeStorage } from '@extension/storage';

import { AiDebugPage } from './page';
import './index.css';

themeStorage.applySystemTheme();
themeStorage.listenToSystemThemeChanges();

const root = document.getElementById('app-container');
if (!root) throw new Error('Could not find #app-container');
createRoot(root).render(<AiDebugPage />);
