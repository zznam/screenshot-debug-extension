import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';

import type { EditorSession } from './session.js';

type CanvasAction = 'UNDO' | 'REDO' | 'START_OVER';
interface SessionContext {
  session: EditorSession;
  command: { type: CanvasAction | null; tick: number };
  triggerCanvasAction: (type: CanvasAction) => void;
}
const Context = createContext<SessionContext | null>(null);
const EditorSessionProvider = ({ session, children }: { session: EditorSession; children: ReactNode }) => {
  const [command, setCommand] = useState<SessionContext['command']>({ type: null, tick: 0 });
  return (
    <Context.Provider
      value={{
        session,
        command,
        triggerCanvasAction: type => setCommand(current => ({ type, tick: current.tick + 1 })),
      }}>
      {children}
    </Context.Provider>
  );
};
const useEditorSession = () => {
  const context = useContext(Context);
  if (!context) throw new Error('The screenshot editor needs its own session.');
  return context;
};
const useSessionAnnotations = (store: EditorSession['annotationsStorage']) =>
  useSyncExternalStore(store.subscribe, store.getSnapshot);

export { EditorSessionProvider, useEditorSession, useSessionAnnotations };
