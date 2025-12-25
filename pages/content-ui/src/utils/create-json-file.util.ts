export const createJsonFile = (data: any, fileName: string) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });

  return new File([blob], fileName, { type: 'application/json' });
};
