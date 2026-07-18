/** Detects whether the browser is in incognito mode using the FileSystem API. */
export const isIncognito = async (): Promise<boolean> => {
  return new Promise(resolve => {
    try {
      const fs = (window as any).RequestFileSystem || (window as any).webkitRequestFileSystem;
      if (!fs) {
        resolve(false);
        return;
      }
      fs(
        window.TEMPORARY,
        100,
        () => resolve(false),
        () => resolve(true),
      );
    } catch (e) {
      resolve(true);
    }
  });
};
