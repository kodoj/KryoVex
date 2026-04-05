import { useEffect, useState } from 'react';
import { getImageStatusSnapshot, subscribeImageStatus } from './useCs2Image.ts';

export function useImageStatus() {
  const [status, setStatus] = useState(getImageStatusSnapshot());

  useEffect(() => {
    return subscribeImageStatus(setStatus);
  }, []);

  return status;
}

