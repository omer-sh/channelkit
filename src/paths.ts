import { join } from 'path';
import { homedir } from 'os';

/** Default home directory for all ChannelKit data: ~/.channelkit */
export const CHANNELKIT_HOME = join(homedir(), '.channelkit');

/** Default config file path */
export const DEFAULT_CONFIG_PATH = join(CHANNELKIT_HOME, 'config.yaml');

/** Default auth directory (WhatsApp sessions, Gmail tokens, etc.) */
export const DEFAULT_AUTH_DIR = join(CHANNELKIT_HOME, 'auth');

/** Default data directory (logs database, etc.) */
export const DEFAULT_DATA_DIR = join(CHANNELKIT_HOME, 'data');
