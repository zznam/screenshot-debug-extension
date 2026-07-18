import { configureStore } from '@reduxjs/toolkit';
import { combineReducers } from 'redux';

import { canvasSlice } from './shared/canvas.reducer.js';
import { canvasReducer } from './shared/index.js';

const rootReducer = combineReducers({
  canvasReducer,
});

const setupStore = () =>
  configureStore({
    reducer: rootReducer,
    middleware: getDefaultMiddleware => getDefaultMiddleware(),
  });

export const store = setupStore();

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof setupStore>;
export type AppDispatch = AppStore['dispatch'];

export const { triggerCanvasAction, clearCanvasState } = canvasSlice.actions;
