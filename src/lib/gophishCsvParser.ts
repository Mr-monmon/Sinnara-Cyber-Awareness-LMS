interface GophishRecord {
  id: string;
  status: string;
  ip: string;
  latitude: string;
  longitude: string;
  send_date: string;
  reported: string;
  modified_date: string;
  email: string;
  first_name: string;
  last_name: string;
  position: string;
}

interface ParsedCampaignData {
  records: GophishRecord[];
  stats: {
    totalRecords: number;
    emailsSent: number;
    emailsOpened: number;
    linksClicked: number;
    dataSubmitted: number;
    emailsReported: number;
  };
}

function parseCSV(csvContent: string): ParsedCampaignData {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV file must contain headers and at least one data row');
  }

  const headers = lines[0].split('\t');
  const records: GophishRecord[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split('\t');
    if (values.length !== headers.length) continue;

    const record: GophishRecord = {
      id: values[0]?.trim() || '',
      status: values[1]?.trim() || '',
      ip: values[2]?.trim() || '',
      latitude: values[3]?.trim() || '',
      longitude: values[4]?.trim() || '',
      send_date: values[5]?.trim() || '',
      reported: values[6]?.trim() || '',
      modified_date: values[7]?.trim() || '',
      email: values[8]?.trim() || '',
      first_name: values[9]?.trim() || '',
      last_name: values[10]?.trim() || '',
      position: values[11]?.trim() || ''
    };

    if (record.id && record.email) {
      records.push(record);
    }
  }

  const stats = {
    totalRecords: records.length,
    emailsSent: records.filter(r => r.status).length,
    emailsOpened: records.filter(r => r.status === 'Opened' || r.status.toLowerCase().includes('opened')).length,
    linksClicked: records.filter(r => r.status === 'Clicked Link').length,
    dataSubmitted: records.filter(r => r.status === 'Submitted Data').length,
    emailsReported: records.filter(r => r.reported.toLowerCase() === 'true' || r.reported === 'TRUE').length
  };

  return { records, stats };
}

function calculateCampaignStats(records: GophishRecord[]) {
  return {
    total_targets: records.length,
    emails_sent: records.filter(r => r.status && r.status.trim() !== '').length,
    emails_opened: records.filter(r => r.modified_date && r.status !== 'Email Sent').length,
    links_clicked: records.filter(r => r.status === 'Clicked Link').length,
    data_submitted: records.filter(r => r.status === 'Submitted Data').length,
    emails_reported: records.filter(r => r.reported.toLowerCase() === 'true' || r.reported === 'TRUE').length
  };
}

function getStatusFromRecord(record: GophishRecord): string {
  if (record.reported.toLowerCase() === 'true' || record.reported === 'TRUE') {
    return 'REPORTED';
  }

  const status = record.status?.trim().toLowerCase() || '';
  if (status === 'submitted data') return 'SUBMITTED';
  if (status === 'clicked link') return 'CLICKED';
  if (status === 'opened') return 'OPENED';
  if (status === 'email sent') return 'SENT';

  return 'SENT';
}

export {
  parseCSV,
  calculateCampaignStats,
  getStatusFromRecord,
  GophishRecord,
  ParsedCampaignData
};
