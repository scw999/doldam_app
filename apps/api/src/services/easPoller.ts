import type { Env } from '../types';

const EAS_PROJECT_ID = 'e319fb49-251c-4449-b120-d58ddb2ddc8d';
const KV_KEY = 'eas:last_notified_build';

interface EasBuild {
  id: string;
  status: string;
  platform: string;
  buildProfile: string;
  appVersion: string;
  gitCommitHash?: string;
  createdAt: string;
  completedAt?: string;
  artifacts?: { applicationArchiveUrl?: string; buildUrl?: string };
  error?: { errorCode?: string; message?: string };
}

async function fetchRecentBuilds(token: string): Promise<EasBuild[]> {
  const query = `{
    app {
      byId(appId: "${EAS_PROJECT_ID}") {
        builds(limit: 5, offset: 0) {
          id status platform buildProfile appVersion gitCommitHash
          createdAt completedAt
          artifacts { applicationArchiveUrl buildUrl }
          error { errorCode message }
        }
      }
    }
  }`;
  const res = await fetch('https://api.expo.dev/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ query }),
  });
  const json = await res.json() as { data?: { app?: { byId?: { builds?: EasBuild[] } } } };
  return json.data?.app?.byId?.builds ?? [];
}

function buildDuration(createdAt: string, completedAt?: string): string {
  if (!completedAt) return '-';
  const ms = new Date(completedAt).getTime() - new Date(createdAt).getTime();
  const min = Math.floor(ms / 60000);
  const sec = Math.floor((ms % 60000) / 1000);
  return `${min}분 ${sec}초`;
}

async function postToSlack(token: string, channel: string, blocks: unknown[], text: string): Promise<void> {
  await fetch('https://slack.com/api/chat.postMessage', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ channel, text, blocks }),
  });
}

function buildSlackBlocks(build: EasBuild): { blocks: unknown[]; text: string } {
  const statusIcon = build.status === 'FINISHED' ? '✅' : build.status === 'ERRORED' ? '❌' : '⛔';
  const statusLabel = build.status === 'FINISHED' ? '빌드 성공' : build.status === 'ERRORED' ? '빌드 실패' : '빌드 취소';
  const platformIcon = build.platform === 'ANDROID' ? '🤖 Android' : '🍎 iOS';
  const downloadUrl = build.artifacts?.applicationArchiveUrl ?? build.artifacts?.buildUrl;

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${statusIcon} 돌담 앱 ${statusLabel}`, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*플랫폼*\n${platformIcon}` },
        { type: 'mrkdwn', text: `*프로필*\n${build.buildProfile}` },
        { type: 'mrkdwn', text: `*버전*\n${build.appVersion}` },
        { type: 'mrkdwn', text: `*소요 시간*\n${buildDuration(build.createdAt, build.completedAt)}` },
      ],
    },
  ];

  const buildUrl = `https://expo.dev/accounts/scw999/projects/doldam/builds/${build.id}`;
  const contextParts = [`빌드 ID: <${buildUrl}|\`${build.id.slice(0, 8)}\`>`];
  if (build.gitCommitHash) contextParts.push(`커밋: \`${build.gitCommitHash.slice(0, 8)}\``);
  blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: contextParts.join('  ·  ') }] });

  if (build.status === 'FINISHED' && downloadUrl) {
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: '📦 APK 다운로드', emoji: true },
          url: downloadUrl,
          style: 'primary',
        },
        {
          type: 'button',
          text: { type: 'plain_text', text: '🔍 빌드 상세', emoji: true },
          url: buildUrl,
        },
      ],
    });
  }

  if (build.status === 'ERRORED' && build.error?.message) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*오류*\n\`\`\`${build.error.message.slice(0, 300)}\`\`\`` },
    });
  }

  return { blocks, text: `${statusIcon} 돌담 앱 ${statusLabel} (${platformIcon} · ${build.buildProfile})` };
}

export async function pollEasBuilds(env: Env): Promise<void> {
  if (!env.EXPO_ACCESS_TOKEN || !env.SLACK_BOT_TOKEN || !env.SLACK_CHANNEL_ID) return;

  const builds = await fetchRecentBuilds(env.EXPO_ACCESS_TOKEN).catch((e) => {
    console.error('[easPoller] fetch error', e);
    return [] as EasBuild[];
  });

  const lastNotified = await env.DOLDAM_KV.get(KV_KEY);
  const terminalStatuses = new Set(['FINISHED', 'ERRORED', 'CANCELED']);
  const newBuilds = builds.filter((b) => terminalStatuses.has(b.status) && b.id !== lastNotified);

  if (newBuilds.length === 0) return;

  // 가장 오래된 것부터 순서대로 알림
  for (const build of newBuilds.reverse()) {
    const { blocks, text } = buildSlackBlocks(build);
    await postToSlack(env.SLACK_BOT_TOKEN, env.SLACK_CHANNEL_ID, blocks, text).catch((e) =>
      console.error('[easPoller] slack error', e)
    );
  }

  await env.DOLDAM_KV.put(KV_KEY, builds[0].id, { expirationTtl: 7 * 86400 });
}
