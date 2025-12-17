import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying database for meetings...');
  const meetings = await prisma.meeting.findMany({
    select: {
      id: true,
      meetingTitle: true,
      title: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  console.log(`Found ${meetings.length} meetings.`);

  const csvHeader = 'Recording ID,Title,Date Created,URL\n';
  const csvRows = meetings.map(m => {
    // Prefer meetingTitle, fallback to title, fallback to "Untitled"
    let displayTitle = m.meetingTitle || m.title || 'Untitled';
    // Escape quotes in title by doubling them
    displayTitle = displayTitle.replace(/"/g, '""');
    
    // Create CSV line: ID, "Title", Date
    return `${m.id},"${displayTitle}",${m.createdAt.toISOString()},https://fathom.video/share/${m.id}`;
  });

  const content = csvHeader + csvRows.join('\n');
  const outputPath = path.join(process.cwd(), 'transcripts_list.csv');
  
  fs.writeFileSync(outputPath, content);
  console.log(`Successfully exported list to ${outputPath}`);
}

main()
  .catch(e => {
    console.error('Error exporting list:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });



