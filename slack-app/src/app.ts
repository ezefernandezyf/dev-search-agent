import { App } from '@slack/bolt';
import type { Middleware, SlackEventMiddlewareArgs } from '@slack/bolt';
import { createAppMentionHandler } from './events/app-mention.js';

const PORT = Number(process.env['SLACK_PORT'] ?? '3000');

const app = new App({
  token: process.env['SLACK_BOT_TOKEN'] ?? '',
  appToken: process.env['SLACK_APP_TOKEN'] ?? '',
  socketMode: true,
});

// Register the app_mention handler
const appMentionHandler = createAppMentionHandler(() => app.client);
app.event('app_mention', appMentionHandler as Middleware<SlackEventMiddlewareArgs<'app_mention'>>);

// Only start when not in test environment
const isTestEnv = typeof process.env['VITEST'] !== 'undefined';
if (!isTestEnv) {
  const startApp = async (): Promise<void> => {
    await app.start(PORT);
    console.log(`⚡ Context Bridge is running on port ${PORT}`);
  };

  startApp().catch((error: unknown) => {
    console.error('Failed to start app:', error);
    process.exit(1);
  });
}

export { app };
