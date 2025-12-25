// Utility to truncate large responses
export const truncateResponse = responseBody => {
  return typeof responseBody === 'string' && responseBody.length > 1000
    ? responseBody.slice(0, 1000) + '... (truncated)'
    : responseBody;
};
