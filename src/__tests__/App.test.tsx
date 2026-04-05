import '@testing-library/jest-dom';
import { act, render } from '@testing-library/react';
import { Provider } from 'react-redux';
import App from '../renderer/App.tsx';
import { store } from '../renderer/store/configureStore.ts';

// Worker-backed sort module uses `import.meta.url`, which ts-jest cannot transpile in this suite.
jest.mock('../renderer/components/content/shared/filters/inventoryFunctions.ts', () => ({
  classNames: (...classes: Array<string | undefined | null | false>) =>
    classes.filter(Boolean).join(' '),
  sortDataFunction: async (_sortValue: unknown, inventory: unknown[]) => inventory,
  sortDataFunctionSync: (_sortValue: unknown, inventory: unknown[]) => inventory,
  filterInventory: async (inventory: unknown[]) => inventory,
  default: (inventory: unknown[]) => inventory,
}));

describe('App', () => {
  it('should render', async () => {
    let result: ReturnType<typeof render> | undefined;
    await act(async () => {
      result = render(
        <Provider store={store}>
          <App />
        </Provider>
      );
      // Flush pending microtasks from initial effects.
      await Promise.resolve();
    });
    expect(result).toBeTruthy();
  });
});
