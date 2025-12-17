import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const FATHOM_API_KEY = process.env.FATHOM_API_KEY;
const BASE_URL = 'https://api.fathom.ai/external/v1';

async function main() {
  if (!FATHOM_API_KEY) {
    throw new Error('FATHOM_API_KEY is missing');
  }

  let cursor: string | null = null;
  let hasMore = true;
  let totalFetched = 0;

  console.log('Starting fetch...');

  while (hasMore) {
    const url = new URL(`${BASE_URL}/meetings`);
    url.searchParams.append('limit', '100');
    url.searchParams.append('include_transcript', 'true');
    // summary might be available for API key auth
    url.searchParams.append('include_summary', 'true'); 
    
    if (cursor) {
      url.searchParams.append('cursor', cursor);
    }

    console.log(`Fetching page with cursor: ${cursor || 'initial'}`);
    
    const res = await fetch(url.toString(), {
      headers: {
        'X-Api-Key': FATHOM_API_KEY,
      },
    });

    if (!res.ok) {
      console.error(`Error fetching meetings: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error('Response:', text);
      break;
    }

    const data = await res.json();
    const items = data.items || [];
    console.log(`Fetched ${items.length} meetings`);
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    for (const item of items) {
       await prisma.meeting.upsert({
         where: { id: String(item.recording_id) },
         update: {
            transcript: item.transcript ? JSON.stringify(item.transcript) : undefined,
            summary: item.default_summary ? JSON.stringify(item.default_summary) : undefined,
         },
         create: {
           id: String(item.recording_id),
           meetingTitle: item.meeting_title,
           title: item.title,
           url: item.url,
           shareUrl: item.share_url,
           createdAt: new Date(item.created_at),
           scheduledStart: item.scheduled_start_time ? new Date(item.scheduled_start_time) : null,
           scheduledEnd: item.scheduled_end_time ? new Date(item.scheduled_end_time) : null,
           recordingStart: item.recording_start_time ? new Date(item.recording_start_time) : null,
           recordingEnd: item.recording_end_time ? new Date(item.recording_end_time) : null,
           transcript: item.transcript ? JSON.stringify(item.transcript) : null,
           summary: item.default_summary ? JSON.stringify(item.default_summary) : null,
         }
       });
    }
    
    totalFetched += items.length;
    cursor = data.next_cursor;
    
    if (!cursor) {
      hasMore = false;
      console.log('No more pages.');
    } else {
        // Correct param name check
        // Docs said: "cursor" for pagination parameter.
        // And response has "next_cursor".
        // The loop above uses `url.searchParams.append('next_cursor', cursor)`. 
        // Docs snapshot said: 
        // "Cursor for pagination." -> parameter name `cursor`.
        // I used `next_cursor` in the loop above by mistake in thought process? No, I wrote `url.searchParams.append('next_cursor', cursor)` in the `write` call.
        // Wait, I need to fix the script to use `cursor` as the parameter name!
    }
    
    // Safety sleep
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`Finished. Total meetings processed: ${totalFetched}`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

