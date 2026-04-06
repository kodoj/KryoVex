import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import App from "./App.tsx";
import returnVar from './store/configureStore.ts'
import './index.css';
const myVar = returnVar()

// Ensure dark mode is enabled globally (Tailwind darkMode: 'class').
// This is intentionally done at runtime to avoid relying on HTML transforms/caching.
document.documentElement.classList.add('dark');

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error('Root element not found');
}
const root = createRoot(rootElement);
// PersistGate lives only inside `App.tsx` (nested gates + loading={null} caused a blank first paint).
root.render(
  <Provider store={myVar.store}>
    <div className="flex h-full min-h-0 flex-col">
      <App />
    </div>
  </Provider>
);