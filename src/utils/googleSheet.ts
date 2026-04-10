import axios from 'axios';

export const getCsvFromGoogleSheet = async (sheetUrl: string): Promise<any[]> => {
  const match = sheetUrl.match(/\/d\/(.*?)\//);

  if (!match) {
    throw new Error('Invalid Google Sheet URL');
  }

  const sheetId = match[1];
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;

  const response = await axios.get(csvUrl);
  const csv = response.data as string;

  const rows = csv
    .split('\n')
    .map(row => row.split(',').map(cell => cell.trim()));

  const headers = rows.shift() as string[];

  return rows.map(row => {
    const obj: any = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
};
