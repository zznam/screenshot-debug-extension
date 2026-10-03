import { createRoot } from 'react-dom/client';

import { themeStorage } from '@extension/storage';

import { LibraryPage } from './page';
import './index.css';

themeStorage.applySystemTheme();
themeStorage.listenToSystemThemeChanges();
const root = document.getElementById('app-container');
if (!root) throw new Error('Could not find the library root.');
createRoot(root).render(<LibraryPage />);
