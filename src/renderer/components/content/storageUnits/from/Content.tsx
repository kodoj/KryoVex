import FromMainComponent from './fromHolder.tsx';

export default function StorageUnits() {
  return (
    <>
      {/* Page title & actions */}
      <div className="frost-sep-b border-b-0 px-4 py-4 sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
        <div className="flex-1 min-w-0 ">
          <h1 className="text-lg font-medium dark:text-dark-white leading-6 mt-2 mb-2 text-gray-900 sm:truncate">
            Transfer from storage units
          </h1>
        </div>
      </div>
      <FromMainComponent />
    </>
  );
}
