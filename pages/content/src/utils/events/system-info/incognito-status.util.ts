/** Detects whether the browser is in incognito mode using the FileSystem API. */
export const isIncognito = async (): Promise<boolean> => {
  return new Promise(resolve => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (e) {
      resolve(true);
    }
  });
};
