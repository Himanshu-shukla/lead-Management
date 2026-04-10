export const normalizeRowKeys = (row: Record<string, any>) => {
    const normalized: Record<string, any> = {};
  
    for (const key in row) {
      if (key) {
        normalized[key.toLowerCase().trim()] = row[key];
      }
    }
  
    return normalized;
  };
  