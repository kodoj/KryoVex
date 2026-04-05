import { CheckCircleIcon } from "@heroicons/react/24/solid";

export function RowMoveable({itemRow, settingsData}) { 
    
    return (
        <>
          {settingsData.columns.includes('Moveable') ? (
                <td
                  key={Math.random().toString(36).substr(2, 9)}
                  className="hidden md:table-cell px-1 py-1 whitespace-nowrap text-center text-sm text-gray-500 dark:text-gray-400"
                >
                  <div className="flex justify-center">
                    {itemRow.item_moveable == true ? (
                      <span title="Item can be moved or traded">
                        <CheckCircleIcon
                          className="h-5 w-5 text-green-500"
                          aria-hidden="true"
                        />
                      </span>
                    ) : (
                      ''
                    )}
                  </div>
                </td>
              ) : (
                ''
              )}
            
        </>
      );
}